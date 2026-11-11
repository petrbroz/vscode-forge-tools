import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import {
    EntryType,
    ITeamAdminAssignment,
    ITeamAdminProductPool,
    ITeamAdminTeam,
    ITeamAdminUser,
    TeamAssignmentDetails,
    TeamDetails,
    TeamProductPoolDetails,
    TeamUserDetails,
    TeamUserInvite
} from '../models/team-admin';

const DEFAULT_HOST = 'https://developer.api.autodesk.com';
const PAGE_LIMIT = 100;

/**
 * Scopes the Team Admin API needs, requested during the 3-legged sign-in when the Team Admin API is
 * enabled via the `autodesk.forge.enableTeamAdminApi` setting. `tmadmapi:team:read` is the only
 * scope that can list teams and also covers reading users, pools, and assignments; the two write scopes
 * cover inviting users and assigning/unassigning products.
 */
export const TEAM_ADMIN_SCOPES: string[] = ['tmadmapi:team:read', 'tmadmapi:team-users:write', 'tmadmapi:team-products:write'];

interface IRequestConfig {
    method: string;
    url: string;
    data?: any;
}

interface IPage<T> {
    data?: T[];
    pagination?: { cursor?: string | null; hasMore?: boolean };
}

/**
 * Domain logic for the Team Admin API (Beta), which manages the users and product seats of the teams the
 * signed-in user administers. There is no official `@aps_sdk/*` SDK for it, so this is a minimal REST
 * wrapper on top of the built-in `fetch`. The API only accepts 3-legged tokens authorized by a team
 * administrator, so the authentication provider is always the active user session.
 */
export class TeamAdminService {
    private readonly baseUrl: string;

    constructor(private readonly authenticationProvider: IAuthenticationProvider, host?: string) {
        this.baseUrl = `${host || DEFAULT_HOST}/team-admin/v1`;
    }

    private async request<T>(config: IRequestConfig): Promise<T> {
        const token = await this.authenticationProvider.getAccessToken(TEAM_ADMIN_SCOPES);
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        let body: string | undefined;
        if (config.data !== undefined) {
            body = JSON.stringify(config.data);
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(`${this.baseUrl}${config.url}`, { method: config.method, headers, body });
        const text = await response.text();
        let data: any;
        try {
            data = text ? JSON.parse(text) : undefined;
        } catch {
            data = text;
        }
        if (!response.ok) {
            const apiMessage = data?.message ?? data?.messages;
            const err: any = new Error(`Request failed with status code ${response.status}${apiMessage ? `: ${apiMessage}` : ''}`);
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => { responseHeaders[key] = value; });
            err.response = { config, data, headers: responseHeaders, status: response.status, statusText: response.statusText };
            throw err;
        }
        return data as T;
    }

    /** Follows the `pagination.cursor` chain of a list endpoint and returns the flattened `data` array. */
    private async getAllPages<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
        let results: T[] = [];
        let cursor: string | undefined;
        do {
            const params = new URLSearchParams({ ...query, limit: String(PAGE_LIMIT) });
            if (cursor) {
                params.set('cursor', cursor);
            }
            const page = await this.request<IPage<T>>({ method: 'GET', url: `${path}?${params.toString()}` });
            results = results.concat(page.data ?? []);
            cursor = page.pagination?.hasMore ? page.pagination.cursor ?? undefined : undefined;
        } while (cursor);
        return results;
    }

    private teamPath(teamId: string): string {
        return `/teams/${encodeURIComponent(teamId)}`;
    }

    /** Lists the teams the signed-in user administers. */
    async getTeams(): Promise<ITeamAdminTeam[]> {
        const teams = await this.getAllPages<TeamDetails>('/teams');
        return teams.map(team => ({ type: EntryType.Team, id: team.id, name: team.name || team.id }));
    }

    async getTeam(teamId: string): Promise<TeamDetails> {
        const teams = await this.getAllPages<TeamDetails>('/teams', { teamId });
        if (teams.length === 0) {
            throw new Error(`Team not found: ${teamId}`);
        }
        return teams[0];
    }

    async getUsers(teamId: string): Promise<ITeamAdminUser[]> {
        const users = await this.getAllPages<TeamUserDetails>(`${this.teamPath(teamId)}/users`);
        return users.map(user => this.toUser(teamId, user));
    }

    getUser(teamId: string, userId: string): Promise<TeamUserDetails> {
        return this.request<TeamUserDetails>({ method: 'GET', url: `${this.teamPath(teamId)}/users/${encodeURIComponent(userId)}` });
    }

    /** Invites a user to the team by email. If they're already on the team, the existing user is returned and no invitation is sent. */
    async addUser(teamId: string, invite: TeamUserInvite): Promise<ITeamAdminUser> {
        const user = await this.request<TeamUserDetails>({ method: 'POST', url: `${this.teamPath(teamId)}/users`, data: invite });
        return this.toUser(teamId, user);
    }

    async getProductPools(teamId: string): Promise<ITeamAdminProductPool[]> {
        const pools = await this.getAllPages<TeamProductPoolDetails>(`${this.teamPath(teamId)}/product-pools`);
        return pools.map(pool => ({
            type: EntryType.ProductPool,
            teamId,
            productId: pool.productId,
            productName: pool.productName || pool.productId,
            totalQuantity: pool.totalQuantity,
            assignedQuantity: pool.assignedQuantity,
            unlimited: pool.unlimited,
            startDate: pool.startDate,
            endDate: pool.endDate
        }));
    }

    /** Lists the team's product assignments (direct and inherited), optionally filtered by product and/or user. This endpoint isn't paginated. */
    async getAssignments(teamId: string, filter: { productId?: string; userId?: string } = {}): Promise<ITeamAdminAssignment[]> {
        const params = new URLSearchParams();
        if (filter.productId) {
            params.set('productId', filter.productId);
        }
        if (filter.userId) {
            params.set('userId', filter.userId);
        }
        const query = params.toString();
        const page = await this.request<IPage<TeamAssignmentDetails>>({ method: 'GET', url: `${this.teamPath(teamId)}/assignments${query ? `?${query}` : ''}` });
        return (page.data ?? []).map(assignment => this.toAssignment(teamId, assignment));
    }

    /** Gives a user a direct seat from a product pool. Repeating it for an existing assignment is a no-op that returns the current assignment. */
    async assignProduct(teamId: string, userId: string, productId: string): Promise<ITeamAdminAssignment> {
        const assignment = await this.request<TeamAssignmentDetails>({
            method: 'POST',
            url: `${this.teamPath(teamId)}/assignments`,
            data: { userId, productId, assignmentType: 'DIRECT' }
        });
        return this.toAssignment(teamId, assignment);
    }

    /** Removes a user's direct assignment of a product. Inherited (team/group) assignments can't be removed through the API. */
    async unassignProduct(teamId: string, userId: string, productId: string): Promise<void> {
        const params = new URLSearchParams({ userId, productId });
        await this.request<void>({ method: 'DELETE', url: `${this.teamPath(teamId)}/assignments?${params.toString()}` });
    }

    private toUser(teamId: string, user: TeamUserDetails): ITeamAdminUser {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
        return {
            type: EntryType.User,
            teamId,
            id: user.id,
            name: name || user.email,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified
        };
    }

    private toAssignment(teamId: string, assignment: TeamAssignmentDetails): ITeamAdminAssignment {
        return {
            type: assignment.assignmentType === 'DIRECT' ? EntryType.DirectAssignment : EntryType.Assignment,
            teamId,
            userId: assignment.userId,
            email: assignment.email,
            productId: assignment.productId,
            productName: assignment.productName || assignment.productId,
            assignmentType: assignment.assignmentType
        };
    }
}
