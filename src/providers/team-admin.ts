import * as vscode from 'vscode';
import { IContext } from '../common';
import { IHint } from '../models/hubs';
import {
    EntryType,
    ITeamAdminAssignment,
    ITeamAdminProductPool,
    ITeamAdminProductPoolsCategory,
    ITeamAdminTeam,
    ITeamAdminUser,
    ITeamAdminUsersCategory
} from '../models/team-admin';

/** The setting that enables the Team Admin API (Beta); when on, the 3-legged sign-in also requests the Team Admin scopes. */
export const TEAM_ADMIN_ENABLED_SETTING = 'autodesk.forge.enableTeamAdminApi';

/** An assignment shown in the tree, either under its user (labeled by product) or under its product pool (labeled by user). */
export type TeamAdminAssignmentEntry = ITeamAdminAssignment & { groupedBy: 'user' | 'product-pool' };

type TeamAdminEntry =
    | ITeamAdminTeam
    | ITeamAdminUsersCategory
    | ITeamAdminProductPoolsCategory
    | ITeamAdminUser
    | ITeamAdminProductPool
    | TeamAdminAssignmentEntry
    | IHint;

function isHint(entry: TeamAdminEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

/** Human-readable seat usage of a product pool, e.g. "18/25 seats" or "unlimited seats". */
export function formatSeats(pool: ITeamAdminProductPool): string {
    if (pool.unlimited) {
        return 'unlimited seats';
    }
    return `${pool.assignedQuantity ?? '?'}/${pool.totalQuantity ?? '?'} seats`;
}

/** Tree view over the Team Admin API: teams the signed-in user administers, their users, product pools, and assignments. */
export class TeamAdminDataProvider implements vscode.TreeDataProvider<TeamAdminEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<TeamAdminEntry | null> = new vscode.EventEmitter<TeamAdminEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<TeamAdminEntry | null> = this._onDidChangeTreeData.event;

    constructor(private readonly _context: IContext) {
    }

    refresh(entry?: TeamAdminEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: TeamAdminEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isHint(entry)) {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = entry.hint;
            node.tooltip = entry.tooltip;
            node.contextValue = 'hint';
            return node;
        }
        switch (entry.type) {
            case EntryType.Team: {
                const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `team-admin-${entry.id}`;
                node.tooltip = [`Team`, `ID: ${entry.id}`, `Name: ${entry.name}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('organization');
                return node;
            }
            case EntryType.UsersCategory: {
                const node = new vscode.TreeItem('Users', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `team-admin-${entry.teamId}-users`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('account');
                return node;
            }
            case EntryType.ProductPoolsCategory: {
                const node = new vscode.TreeItem('Product Pools', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `team-admin-${entry.teamId}-product-pools`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('package');
                return node;
            }
            case EntryType.User: {
                const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `team-admin-${entry.teamId}-user-${entry.id}`;
                node.description = entry.role;
                node.tooltip = [
                    `User`,
                    `ID: ${entry.id}`,
                    `Name: ${entry.name}`,
                    `E-mail: ${entry.email}`,
                    `Role: ${entry.role}`,
                    `Registration pending: ${entry.isEmailVerified ? 'no' : 'yes'}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon(entry.isEmailVerified ? 'person' : 'mail');
                return node;
            }
            case EntryType.ProductPool: {
                const node = new vscode.TreeItem(entry.productName, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `team-admin-${entry.teamId}-pool-${entry.productId}`;
                node.description = formatSeats(entry);
                node.tooltip = [
                    `Product Pool`,
                    `Product ID: ${entry.productId}`,
                    `Product: ${entry.productName}`,
                    `Seats: ${formatSeats(entry)}`,
                    `Start: ${entry.startDate}`,
                    `End: ${entry.endDate}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('package');
                return node;
            }
            case EntryType.Assignment:
            case EntryType.DirectAssignment: {
                const label = entry.groupedBy === 'user' ? entry.productName : entry.email;
                const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                node.id = `team-admin-${entry.teamId}-${entry.groupedBy}-assignment-${entry.userId}-${entry.productId}`;
                node.description = entry.assignmentType;
                node.tooltip = [
                    `Assignment`,
                    `User ID: ${entry.userId}`,
                    `E-mail: ${entry.email}`,
                    `Product ID: ${entry.productId}`,
                    `Product: ${entry.productName}`,
                    `Type: ${entry.assignmentType}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon(entry.type === EntryType.DirectAssignment ? 'pass' : 'link');
                return node;
            }
        }
    }

    async getChildren(entry?: TeamAdminEntry): Promise<TeamAdminEntry[]> {
        if (!entry) {
            return this.getRoots();
        }
        if (isHint(entry)) {
            return [];
        }
        switch (entry.type) {
            case EntryType.Team:
                return [
                    { type: EntryType.UsersCategory, teamId: entry.id },
                    { type: EntryType.ProductPoolsCategory, teamId: entry.id }
                ];
            case EntryType.UsersCategory:
                return this.load('users', () => this._context.teamAdminService.getUsers(entry.teamId));
            case EntryType.ProductPoolsCategory:
                return this.load('product pools', () => this._context.teamAdminService.getProductPools(entry.teamId));
            case EntryType.User:
                return this.load('assignments', async () =>
                    (await this._context.teamAdminService.getAssignments(entry.teamId, { userId: entry.id }))
                        .map(assignment => ({ ...assignment, groupedBy: 'user' as const })));
            case EntryType.ProductPool:
                return this.load('assignments', async () =>
                    (await this._context.teamAdminService.getAssignments(entry.teamId, { productId: entry.productId }))
                        .map(assignment => ({ ...assignment, groupedBy: 'product-pool' as const })));
            default:
                return [];
        }
    }

    private async getRoots(): Promise<TeamAdminEntry[]> {
        const session = this._context.session;
        // No session, or the Team Admin API not enabled -> return nothing so the matching welcome view is shown instead.
        if (!session || !vscode.workspace.getConfiguration(undefined, null).get<boolean>(TEAM_ADMIN_ENABLED_SETTING)) {
            return [];
        }
        if (session.mode.kind === 'service-account') {
            return [{ hint: 'Service accounts are not supported.', tooltip: 'The Team Admin API only accepts 3-legged tokens authorized by a team administrator.' }];
        }
        if (session.mode.kind !== 'manual-token' && !session.scopes.some(scope => scope.startsWith('tmadmapi:'))) {
            return [{ hint: 'Sign in again to grant Team Admin scopes.', tooltip: 'The current session was created before Team Admin scopes were requested. Sign out and sign in again.' }];
        }
        return this.load('teams', () => this._context.teamAdminService.getTeams());
    }

    private async load(what: string, fetch: () => Promise<TeamAdminEntry[]>): Promise<TeamAdminEntry[]> {
        try {
            const entries = await fetch();
            return entries.length > 0 ? entries : [{ hint: `No ${what} found.`, tooltip: '' }];
        } catch (err: any) {
            this._context.log.error(`Could not retrieve ${what}`);
            this._context.log.error(err);
            const tooltip = err?.response?.status === 403
                ? 'Make sure your APS app has the Team Admin API enabled, and that you are an administrator of the team.'
                : `An error occurred while retrieving data from the Team Admin API: ${err?.message ?? err}`;
            return [{ hint: `Could not retrieve ${what}.`, tooltip }];
        }
    }
}
