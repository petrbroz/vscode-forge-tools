import * as vscode from 'vscode';
import { IContext, command, showReadOnlyJson, withProgress } from '../common';
import { IHubAdminCompany, IHubAdminHub, IHubAdminProject, IHubAdminProjectUser, IHubAdminUser } from '../models/hub-admin';
import { hubAdminServiceFor, hubsServiceFor } from '../providers/hub-admin';

export class HubAdminCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.hubAdmin.refresh', this.refreshHubAdmin.bind(this)),
            command(this.context, 'aps.hubAdmin.viewHubDetails', 'Could not retrieve hub details', this.viewHubDetails.bind(this)),
            command(this.context, 'aps.hubAdmin.viewUserDetails', 'Could not retrieve hub admin user details', this.viewUserDetails.bind(this)),
            command(this.context, 'aps.hubAdmin.copyUserID', this.copyUserID.bind(this)),
            command(this.context, 'aps.hubAdmin.viewProjectDetails', 'Could not retrieve hub admin project details', this.viewProjectDetails.bind(this)),
            command(this.context, 'aps.hubAdmin.copyProjectID', this.copyProjectID.bind(this)),
            command(this.context, 'aps.hubAdmin.viewProjectUserDetails', 'Could not retrieve project user details', this.viewProjectUserDetails.bind(this)),
            command(this.context, 'aps.hubAdmin.copyProjectUserID', this.copyProjectUserID.bind(this)),
            command(this.context, 'aps.hubAdmin.viewCompanyDetails', 'Could not retrieve hub admin company details', this.viewCompanyDetails.bind(this)),
            command(this.context, 'aps.hubAdmin.copyCompanyID', this.copyCompanyID.bind(this)),
        ];
    }

    async refreshHubAdmin() {
        this.refresh();
    }

    async viewHubDetails(hub: IHubAdminHub) {
        const details = await withProgress(
            `Getting hub details: ${hub.id}`,
            hubsServiceFor(this.context, hub.authContext).getHubDetails(hub.id)
        );
        await showReadOnlyJson(this.context, ['hub-admin', hub.authContext, 'hubs', hub.id], details);
    }

    async viewUserDetails(user: IHubAdminUser) {
        const details = await withProgress(
            `Getting hub admin user details: ${user.id}`,
            hubAdminServiceFor(this.context, user.authContext).getUser(user.accountId, user.id)
        );
        await showReadOnlyJson(this.context, ['hub-admin', user.authContext, 'users', user.id], details);
    }

    async copyUserID(user: IHubAdminUser) {
        await vscode.env.clipboard.writeText(user.id);
        vscode.window.showInformationMessage(`Hub admin user ID copied to clipboard: ${user.id}`);
    }

    async viewProjectDetails(project: IHubAdminProject) {
        const details = await withProgress(
            `Getting hub admin project details: ${project.id}`,
            hubAdminServiceFor(this.context, project.authContext).getProject(project.id)
        );
        await showReadOnlyJson(this.context, ['hub-admin', project.authContext, 'projects', project.id], details);
    }

    async copyProjectID(project: IHubAdminProject) {
        await vscode.env.clipboard.writeText(project.id);
        vscode.window.showInformationMessage(`Hub admin project ID copied to clipboard: ${project.id}`);
    }

    async viewProjectUserDetails(projectUser: IHubAdminProjectUser) {
        const details = await withProgress(
            `Getting project user details: ${projectUser.id}`,
            hubAdminServiceFor(this.context, projectUser.authContext).getProjectUser(projectUser.projectId, projectUser.id)
        );
        await showReadOnlyJson(this.context, ['hub-admin', projectUser.authContext, 'project-users', projectUser.id], details);
    }

    async copyProjectUserID(projectUser: IHubAdminProjectUser) {
        await vscode.env.clipboard.writeText(projectUser.id);
        vscode.window.showInformationMessage(`Project user ID copied to clipboard: ${projectUser.id}`);
    }

    async viewCompanyDetails(company: IHubAdminCompany) {
        const details = await withProgress(
            `Getting hub admin company details: ${company.id}`,
            hubAdminServiceFor(this.context, company.authContext).getCompany(company.id, company.accountId)
        );
        await showReadOnlyJson(this.context, ['hub-admin', company.authContext, 'companies', company.id], details);
    }

    async copyCompanyID(company: IHubAdminCompany) {
        await vscode.env.clipboard.writeText(company.id);
        vscode.window.showInformationMessage(`Hub admin company ID copied to clipboard: ${company.id}`);
    }
}
