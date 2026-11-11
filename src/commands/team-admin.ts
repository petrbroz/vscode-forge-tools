import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, showReadOnlyJson, withProgress } from '../common';
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
            vscode.commands.registerCommand('aps.teamAdmin.refresh', this.refreshTeamAdmin.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.viewTeamDetailsJSON', this.viewTeamDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.copyTeamID', this.copyTeamID.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.addUser', this.addUser.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.viewUserDetails', this.viewUserDetails.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.viewUserDetailsJSON', this.viewUserDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.copyUserID', this.copyUserID.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.viewProductPoolDetailsJSON', this.viewProductPoolDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.copyProductID', this.copyProductID.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.assignProduct', this.assignProduct.bind(this)),
            vscode.commands.registerCommand('aps.teamAdmin.unassignProduct', this.unassignProduct.bind(this)),
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

    async viewTeamDetailsJSON(team?: ITeamAdminTeam) {
        try {
            team = this.ensureInput(team);
            const details = await withProgress(`Getting team details: ${team.id}`, this.context.teamAdminService.getTeam(team.id));
            await showReadOnlyJson(this.context, ['team-admin', 'teams', team.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve team details', err, this.context);
        }
    }

    async copyTeamID(team?: ITeamAdminTeam) {
        team = this.ensureInput(team);
        await vscode.env.clipboard.writeText(team.id);
        vscode.window.showInformationMessage(`Team ID copied to clipboard: ${team.id}`);
    }

    /** Invites a user to a team by email. Triggered from a team or its "Users" node. */
    async addUser(entry?: ITeamAdminTeam | ITeamAdminUsersCategory) {
        try {
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
        } catch (err) {
            showErrorMessage('Could not add user to team', err, this.context);
        }
    }

    async viewUserDetails(user?: ITeamAdminUser) {
        try {
            user = this.ensureInput(user);
            const service = this.context.teamAdminService;
            const [detail, assignments] = await withProgress(`Getting team user details: ${user.email}`, Promise.all([
                service.getUser(user.teamId, user.id),
                service.getAssignments(user.teamId, { userId: user.id })
            ]));
            createWebViewPanel(this.context, 'team-admin-user-details.js', 'team-admin-user-details', `Team User Details: ${user.name}`, { detail, assignments });
        } catch (err) {
            showErrorMessage('Could not retrieve team user details', err, this.context);
        }
    }

    async viewUserDetailsJSON(user?: ITeamAdminUser) {
        try {
            user = this.ensureInput(user);
            const details = await withProgress(`Getting team user details: ${user.email}`, this.context.teamAdminService.getUser(user.teamId, user.id));
            await showReadOnlyJson(this.context, ['team-admin', user.teamId, 'users', user.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve team user details', err, this.context);
        }
    }

    async copyUserID(user?: ITeamAdminUser) {
        user = this.ensureInput(user);
        await vscode.env.clipboard.writeText(user.id);
        vscode.window.showInformationMessage(`Team user ID copied to clipboard: ${user.id}`);
    }

    async viewProductPoolDetailsJSON(pool?: ITeamAdminProductPool) {
        try {
            pool = this.ensureInput(pool);
            const { type, ...details } = pool;
            await showReadOnlyJson(this.context, ['team-admin', pool.teamId, 'product-pools', pool.productId], details);
        } catch (err) {
            showErrorMessage('Could not show product pool details', err, this.context);
        }
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
        try {
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
        } catch (err) {
            showErrorMessage('Could not assign product', err, this.context);
        }
    }

    /** Removes a user's direct assignment of a product, releasing its seat. */
    async unassignProduct(assignment?: TeamAdminAssignmentEntry) {
        try {
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
        } catch (err) {
            showErrorMessage('Could not unassign product', err, this.context);
        }
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
