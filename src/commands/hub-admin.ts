import * as vscode from 'vscode';
import { IContext, showErrorMessage, showReadOnlyJson, withProgress } from '../common';
import { IHubAdminCompany, IHubAdminProject, IHubAdminProjectUser, IHubAdminUser } from '../models/hub-admin';
import { hubAdminServiceFor } from '../providers/hub-admin';

export class HubAdminCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.hubAdmin.refresh', this.refreshHubAdmin.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewUserDetails', this.viewUserDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyUserID', this.copyUserID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectDetails', this.viewProjectDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyProjectID', this.copyProjectID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectUserDetails', this.viewProjectUserDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyProjectUserID', this.copyProjectUserID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewCompanyDetails', this.viewCompanyDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyCompanyID', this.copyCompanyID.bind(this)),
        ];
    }

    async refreshHubAdmin() {
        this.refresh();
    }

    async viewUserDetails(user: IHubAdminUser) {
        try {
            const details = await withProgress(
                `Getting hub admin user details: ${user.id}`,
                hubAdminServiceFor(this.context, user.authContext).getUser(user.accountId, user.id)
            );
            await showReadOnlyJson(this.context, ['hub-admin', user.authContext, 'users', user.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin user details', err, this.context);
        }
    }

    async copyUserID(user: IHubAdminUser) {
        await vscode.env.clipboard.writeText(user.id);
        vscode.window.showInformationMessage(`Hub admin user ID copied to clipboard: ${user.id}`);
    }

    async viewProjectDetails(project: IHubAdminProject) {
        try {
            const details = await withProgress(
                `Getting hub admin project details: ${project.id}`,
                hubAdminServiceFor(this.context, project.authContext).getProject(project.id)
            );
            await showReadOnlyJson(this.context, ['hub-admin', project.authContext, 'projects', project.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin project details', err, this.context);
        }
    }

    async copyProjectID(project: IHubAdminProject) {
        await vscode.env.clipboard.writeText(project.id);
        vscode.window.showInformationMessage(`Hub admin project ID copied to clipboard: ${project.id}`);
    }

    async viewProjectUserDetails(projectUser: IHubAdminProjectUser) {
        try {
            const details = await withProgress(
                `Getting project user details: ${projectUser.id}`,
                hubAdminServiceFor(this.context, projectUser.authContext).getProjectUser(projectUser.projectId, projectUser.id)
            );
            await showReadOnlyJson(this.context, ['hub-admin', projectUser.authContext, 'project-users', projectUser.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve project user details', err, this.context);
        }
    }

    async copyProjectUserID(projectUser: IHubAdminProjectUser) {
        await vscode.env.clipboard.writeText(projectUser.id);
        vscode.window.showInformationMessage(`Project user ID copied to clipboard: ${projectUser.id}`);
    }

    async viewCompanyDetails(company: IHubAdminCompany) {
        try {
            const details = await withProgress(
                `Getting hub admin company details: ${company.id}`,
                hubAdminServiceFor(this.context, company.authContext).getCompany(company.id, company.accountId)
            );
            await showReadOnlyJson(this.context, ['hub-admin', company.authContext, 'companies', company.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin company details', err, this.context);
        }
    }

    async copyCompanyID(company: IHubAdminCompany) {
        await vscode.env.clipboard.writeText(company.id);
        vscode.window.showInformationMessage(`Hub admin company ID copied to clipboard: ${company.id}`);
    }
}
