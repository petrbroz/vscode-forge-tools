import * as vscode from 'vscode';
import { IContext, command, showReadOnlyJson, withProgress } from '../common';
import {
    EntryType,
    ITeamAdminProductPool,
    ITeamAdminProductPoolsCategory,
    ITeamAdminTeam,
    ITeamAdminUser,
    ITeamAdminUsersCategory
} from '../models/team-admin';
import { formatSeats, TeamAdminAssignmentEntry } from '../providers/team-admin';

export class TeamAdminCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.teamAdmin.refresh', this.refreshTeamAdmin.bind(this)),
            command(this.context, 'aps.teamAdmin.viewTeamDetails', 'Could not retrieve team details', this.viewTeamDetails.bind(this)),
            command(this.context, 'aps.teamAdmin.copyTeamID', this.copyTeamID.bind(this)),
            command(this.context, 'aps.teamAdmin.addUser', 'Could not add user to team', this.addUser.bind(this)),
            command(this.context, 'aps.teamAdmin.viewUserDetails', 'Could not retrieve team user details', this.viewUserDetails.bind(this)),
            command(this.context, 'aps.teamAdmin.copyUserID', this.copyUserID.bind(this)),
            command(this.context, 'aps.teamAdmin.viewProductPoolDetails', 'Could not show product pool details', this.viewProductPoolDetails.bind(this)),
            command(this.context, 'aps.teamAdmin.copyProductID', this.copyProductID.bind(this)),
            command(this.context, 'aps.teamAdmin.assignProduct', 'Could not assign product', this.assignProduct.bind(this)),
            command(this.context, 'aps.teamAdmin.unassignProduct', 'Could not unassign product', this.unassignProduct.bind(this)),
        ];
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async refreshTeamAdmin() {
        this.refresh();
    }

    async viewTeamDetails(team?: ITeamAdminTeam) {
        team = this.ensureInput(team);
        const details = await withProgress(`Getting team details: ${team.id}`, this.context.teamAdminService.getTeam(team.id));
        await showReadOnlyJson(this.context, ['team-admin', 'teams', team.id], details);
    }

    async copyTeamID(team?: ITeamAdminTeam) {
        team = this.ensureInput(team);
        await vscode.env.clipboard.writeText(team.id);
        vscode.window.showInformationMessage(`Team ID copied to clipboard: ${team.id}`);
    }

    /** Invites a user to a team by email. Triggered from a team or its "Users" node. */
    async addUser(entry?: ITeamAdminTeam | ITeamAdminUsersCategory) {
        entry = this.ensureInput(entry);
        const teamId = entry.type === EntryType.Team ? entry.id : entry.teamId;
        const email = await vscode.window.showInputBox({
            prompt: 'E-mail address of the user to invite to the team',
            ignoreFocusOut: true,
            validateInput: value => /^\S+@\S+\.\S+$/.test(value.trim()) ? undefined : 'Enter a valid e-mail address'
        });
        if (!email) {
            return;
        }
        const firstName = await vscode.window.showInputBox({ prompt: 'First name (optional, only used if the user has no Autodesk account yet)', ignoreFocusOut: true });
        if (firstName === undefined) {
            return;
        }
        const lastName = await vscode.window.showInputBox({ prompt: 'Last name (optional, only used if the user has no Autodesk account yet)', ignoreFocusOut: true });
        if (lastName === undefined) {
            return;
        }
        const user = await withProgress(`Adding user to team: ${email}`, this.context.teamAdminService.addUser(teamId, {
            email: email.trim(),
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            ...(lastName.trim() ? { lastName: lastName.trim() } : {})
        }));
        vscode.window.showInformationMessage(`User added to team: ${user.email} (${user.role}). They may need to accept the invitation.`);
        this.refresh();
    }

    async viewUserDetails(user?: ITeamAdminUser) {
        user = this.ensureInput(user);
        const service = this.context.teamAdminService;
        const [detail, assignments] = await withProgress(`Getting team user details: ${user.email}`, Promise.all([
            service.getUser(user.teamId, user.id),
            service.getAssignments(user.teamId, { userId: user.id })
        ]));
        await showReadOnlyJson(this.context, ['team-admin', user.teamId, 'users', user.id, 'details'], { ...detail, assignments });
    }

    async copyUserID(user?: ITeamAdminUser) {
        user = this.ensureInput(user);
        await vscode.env.clipboard.writeText(user.id);
        vscode.window.showInformationMessage(`Team user ID copied to clipboard: ${user.id}`);
    }

    async viewProductPoolDetails(pool?: ITeamAdminProductPool) {
        pool = this.ensureInput(pool);
        const { type, ...details } = pool;
        await showReadOnlyJson(this.context, ['team-admin', pool.teamId, 'product-pools', pool.productId], details);
    }

    async copyProductID(pool?: ITeamAdminProductPool) {
        pool = this.ensureInput(pool);
        await vscode.env.clipboard.writeText(pool.productId);
        vscode.window.showInformationMessage(`Product ID copied to clipboard: ${pool.productId}`);
    }

    /**
     * Gives a user a direct seat from a product pool. Triggered from a user (prompts for the pool) or from
     * a product pool (prompts for the user).
     */
    async assignProduct(entry?: ITeamAdminUser | ITeamAdminProductPool | ITeamAdminProductPoolsCategory) {
        entry = this.ensureInput(entry);
        const service = this.context.teamAdminService;
        let user: ITeamAdminUser | undefined;
        let pool: ITeamAdminProductPool | undefined;
        if (entry.type === EntryType.User) {
            user = entry;
            pool = await this.promptProductPool(entry.teamId);
        } else if (entry.type === EntryType.ProductPool) {
            pool = entry;
            user = await this.promptUser(entry.teamId);
        } else {
            pool = await this.promptProductPool(entry.teamId);
            user = pool && await this.promptUser(entry.teamId);
        }
        if (!user || !pool) {
            return;
        }
        const assignment = await withProgress(
            `Assigning ${pool.productName} to ${user.email}`,
            service.assignProduct(user.teamId, user.id, pool.productId)
        );
        vscode.window.showInformationMessage(`${assignment.productName} assigned to ${assignment.email} (${assignment.assignmentType}).`);
        this.refresh();
    }

    /** Removes a user's direct assignment of a product, releasing its seat. */
    async unassignProduct(assignment?: TeamAdminAssignmentEntry) {
        assignment = this.ensureInput(assignment);
        const confirm = await vscode.window.showWarningMessage(
            `Remove the direct assignment of ${assignment.productName} from ${assignment.email}? The user keeps any access inherited through the team or a group.`,
            { modal: true },
            'Unassign'
        );
        if (confirm !== 'Unassign') {
            return;
        }
        await withProgress(
            `Unassigning ${assignment.productName} from ${assignment.email}`,
            this.context.teamAdminService.unassignProduct(assignment.teamId, assignment.userId, assignment.productId)
        );
        vscode.window.showInformationMessage(`${assignment.productName} unassigned from ${assignment.email}.`);
        this.refresh();
    }

    private async promptProductPool(teamId: string): Promise<ITeamAdminProductPool | undefined> {
        const pools = await withProgress('Getting product pools...', this.context.teamAdminService.getProductPools(teamId));
        if (pools.length === 0) {
            vscode.window.showInformationMessage('This team has no product pools that can be assigned.');
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(
            pools.map(pool => ({ label: pool.productName, description: formatSeats(pool), detail: `${pool.startDate} – ${pool.endDate}`, pool })),
            { placeHolder: 'Select a product pool', ignoreFocusOut: true, matchOnDescription: true }
        );
        return picked?.pool;
    }

    private async promptUser(teamId: string): Promise<ITeamAdminUser | undefined> {
        const users = await withProgress('Getting team users...', this.context.teamAdminService.getUsers(teamId));
        if (users.length === 0) {
            vscode.window.showInformationMessage('This team has no users.');
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(
            users.map(user => ({ label: user.name, description: user.email, detail: user.role, user })),
            { placeHolder: 'Select a user', ignoreFocusOut: true, matchOnDescription: true }
        );
        return picked?.user;
    }
}
