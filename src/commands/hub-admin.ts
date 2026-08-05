import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, showReadOnlyJson, withProgress } from '../common';
import { IHubAdminCompany, IHubAdminHub, IHubAdminProject, IHubAdminProjectUser, IHubAdminUser } from '../models/hub-admin';
import { hubAdminServiceFor, hubsServiceFor } from '../providers/hub-admin';

export class HubAdminCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.hubAdmin.refresh', this.refreshHubAdmin.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewHubDetails', this.viewHubDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewHubDetailsJSON', this.viewHubDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewUserDetails', this.viewUserDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewUserDetailsJSON', this.viewUserDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyUserID', this.copyUserID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectDetails', this.viewProjectDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectDetailsJSON', this.viewProjectDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyProjectID', this.copyProjectID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectUserDetails', this.viewProjectUserDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewProjectUserDetailsJSON', this.viewProjectUserDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyProjectUserID', this.copyProjectUserID.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewCompanyDetails', this.viewCompanyDetails.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.viewCompanyDetailsJSON', this.viewCompanyDetailsJSON.bind(this)),
            vscode.commands.registerCommand('aps.hubAdmin.copyCompanyID', this.copyCompanyID.bind(this)),
        ];
    }

    async refreshHubAdmin() {
        this.refresh();
    }

    async viewHubDetails(hub: IHubAdminHub) {
        try {
            const details = await withProgress(
                `Getting hub details: ${hub.id}`,
                hubsServiceFor(this.context, hub.authContext).getHubDetails(hub.id)
            );
            createWebViewPanel(this.context, 'hub-admin-hub-details.js', 'hub-admin-hub-details', `Hub Details: ${details.name}`, { detail: details });
        } catch (err) {
            showErrorMessage('Could not retrieve hub details', err, this.context);
        }
    }

    async viewHubDetailsJSON(hub: IHubAdminHub) {
        try {
            const details = await withProgress(
                `Getting hub details: ${hub.id}`,
                hubsServiceFor(this.context, hub.authContext).getHubDetails(hub.id)
            );
            await showReadOnlyJson(this.context, ['hub-admin', hub.authContext, 'hubs', hub.id], details);
        } catch (err) {
            showErrorMessage('Could not retrieve hub details', err, this.context);
        }
    }

    async viewUserDetails(user: IHubAdminUser) {
        try {
            const service = hubAdminServiceFor(this.context, user.authContext);
            const details = await withProgress(`Getting hub admin user details: ${user.id}`, service.getUser(user.accountId, user.id));
            const imageDataUri = await service.getProfileImageDataUri(details.image_url);
            createWebViewPanel(this.context, 'hub-admin-user-details.js', 'hub-admin-user-details', `User Details: ${details.name || details.email}`, { detail: details, imageDataUri });
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin user details', err, this.context);
        }
    }

    async viewUserDetailsJSON(user: IHubAdminUser) {
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
            createWebViewPanel(this.context, 'hub-admin-project-details.js', 'hub-admin-project-details', `Project Details: ${details.name}`, { detail: details });
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin project details', err, this.context);
        }
    }

    async viewProjectDetailsJSON(project: IHubAdminProject) {
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
            const service = hubAdminServiceFor(this.context, projectUser.authContext);
            const details = await withProgress(`Getting project user details: ${projectUser.id}`, service.getProjectUser(projectUser.projectId, projectUser.id));
            const imageDataUri = await service.getProfileImageDataUri(details.imageUrl);
            createWebViewPanel(this.context, 'hub-admin-project-user-details.js', 'hub-admin-project-user-details', `Project User Details: ${details.name || details.email}`, { detail: details, imageDataUri });
        } catch (err) {
            showErrorMessage('Could not retrieve project user details', err, this.context);
        }
    }

    async viewProjectUserDetailsJSON(projectUser: IHubAdminProjectUser) {
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
            createWebViewPanel(this.context, 'hub-admin-company-details.js', 'hub-admin-company-details', `Company Details: ${details.name}`, { detail: details });
        } catch (err) {
            showErrorMessage('Could not retrieve hub admin company details', err, this.context);
        }
    }

    async viewCompanyDetailsJSON(company: IHubAdminCompany) {
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
