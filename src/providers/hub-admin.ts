import * as vscode from 'vscode';
import { IContext, showErrorMessage, stringPropertySorter } from '../common';
import {
    EntryType,
    HubAdminAuthContext,
    IHubAdminCompaniesCategory,
    IHubAdminCompany,
    IHubAdminHub,
    IHubAdminProject,
    IHubAdminProjectsCategory,
    IHubAdminProjectUser,
    IHubAdminProjectUsersCategory,
    IHubAdminUser,
    IHubAdminUsersCategory
} from '../models/hub-admin';
import { HubAdminService } from '../services/hub-admin';
import { HubsService } from '../services/hubs';

/** The Hub Admin service instance backing a given auth context (app vs. active user session). */
export function hubAdminServiceFor(context: IContext, authContext: HubAdminAuthContext): HubAdminService {
    return authContext === 'user' ? context.hubAdminServiceUser : context.hubAdminServiceApp;
}

/** The Hubs (Data Management) service instance backing a given auth context (app vs. active user session). */
export function hubsServiceFor(context: IContext, authContext: HubAdminAuthContext): HubsService {
    return authContext === 'user' ? context.hubsService : context.hubsServiceApp;
}

type HubAdminEntry =
    | IHubAdminHub
    | IHubAdminUsersCategory
    | IHubAdminProjectsCategory
    | IHubAdminCompaniesCategory
    | IHubAdminUser
    | IHubAdminProject
    | IHubAdminProjectUsersCategory
    | IHubAdminProjectUser
    | IHubAdminCompany;

export class HubAdminDataProvider implements vscode.TreeDataProvider<HubAdminEntry> {
    private _context: IContext;
    private _authContext: HubAdminAuthContext;
    private _onDidChangeTreeData: vscode.EventEmitter<HubAdminEntry | null> = new vscode.EventEmitter<HubAdminEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<HubAdminEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext, authContext: HubAdminAuthContext) {
        this._context = context;
        this._authContext = authContext;
    }

    refresh(entry?: HubAdminEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: HubAdminEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        switch (entry.type) {
            case EntryType.Hub: {
                const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.id}`;
                node.tooltip = [`Hub`, `ID: ${entry.id}`, `Account ID: ${entry.accountId}`, `Name: ${entry.name}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('organization');
                return node;
            }
            case EntryType.UsersCategory: {
                const node = new vscode.TreeItem('Users', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.accountId}-users`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('account');
                return node;
            }
            case EntryType.ProjectsCategory: {
                const node = new vscode.TreeItem('Projects', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.accountId}-projects`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('project');
                return node;
            }
            case EntryType.CompaniesCategory: {
                const node = new vscode.TreeItem('Companies', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.accountId}-companies`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('briefcase');
                return node;
            }
            case EntryType.User: {
                const node = new vscode.TreeItem(entry.name || entry.email, vscode.TreeItemCollapsibleState.None);
                node.id = `${this._authContext}-${entry.accountId}-user-${entry.id}`;
                node.tooltip = [`Hub Admin User`, `ID: ${entry.id}`, `Name: ${entry.name}`, `E-mail: ${entry.email}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('person');
                return node;
            }
            case EntryType.Project: {
                const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.accountId}-project-${entry.id}`;
                node.tooltip = [`Project`, `ID: ${entry.id}`, `Name: ${entry.name}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('folder-library');
                return node;
            }
            case EntryType.ProjectUsersCategory: {
                const node = new vscode.TreeItem('Users', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `${this._authContext}-${entry.projectId}-users`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('account');
                return node;
            }
            case EntryType.ProjectUser: {
                const node = new vscode.TreeItem(entry.name || entry.email, vscode.TreeItemCollapsibleState.None);
                node.id = `${this._authContext}-${entry.projectId}-user-${entry.id}`;
                node.tooltip = [`Project User`, `ID: ${entry.id}`, `Name: ${entry.name}`, `E-mail: ${entry.email}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('person');
                return node;
            }
            case EntryType.Company: {
                const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.None);
                node.id = `${this._authContext}-${entry.accountId}-company-${entry.id}`;
                node.tooltip = [`Company`, `ID: ${entry.id}`, `Name: ${entry.name}`].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('briefcase');
                return node;
            }
        }
    }

    async getChildren(entry?: HubAdminEntry | undefined): Promise<HubAdminEntry[]> {
        const authContext = this._authContext;
        if (!entry) {
            // User-context hub admin data needs a user session -> show the "Sign in to APS" welcome view instead.
            if (authContext === 'user' && !this._context.session) {
                return [];
            }
            return this._getHubs();
        }

        switch (entry.type) {
            case EntryType.Hub: {
                const { accountId } = entry;
                return [
                    { type: EntryType.UsersCategory, accountId, authContext },
                    { type: EntryType.ProjectsCategory, accountId, authContext },
                    { type: EntryType.CompaniesCategory, accountId, authContext }
                ];
            }
            case EntryType.UsersCategory:
                return this._getUsers(entry.accountId);
            case EntryType.ProjectsCategory:
                return this._getProjects(entry.accountId);
            case EntryType.CompaniesCategory:
                return this._getCompanies(entry.accountId);
            case EntryType.Project:
                return [{ type: EntryType.ProjectUsersCategory, projectId: entry.id, authContext }];
            case EntryType.ProjectUsersCategory:
                return this._getProjectUsers(entry.projectId);
            case EntryType.User:
            case EntryType.ProjectUser:
            case EntryType.Company:
                return [];
        }
    }

    private async _getHubs(): Promise<IHubAdminHub[]> {
        try {
            const hubsService = this._authContext === 'user' ? this._context.hubsService : this._context.hubsServiceApp;
            const hubs = await hubsService.getHubs();
            return hubs.map(hub => ({
                type: EntryType.Hub,
                id: hub.id,
                accountId: hub.id.replace(/^b\./, ''),
                name: hub.name,
                authContext: this._authContext
            }));
        } catch (err) {
            showErrorMessage(`Could not list hubs`, err);
            return [];
        }
    }

    private async _getUsers(accountId: string): Promise<IHubAdminUser[]> {
        try {
            const users = await hubAdminServiceFor(this._context, this._authContext).getUsers(accountId);
            return users.map((user): IHubAdminUser => ({
                type: EntryType.User,
                id: user.id!,
                accountId,
                name: user.name || '',
                email: user.email || '',
                authContext: this._authContext
            })).sort(stringPropertySorter('name'));
        } catch (err) {
            showErrorMessage(`Could not list hub admin users`, err);
            return [];
        }
    }

    private async _getProjects(accountId: string): Promise<IHubAdminProject[]> {
        try {
            const projects = await hubAdminServiceFor(this._context, this._authContext).getProjects(accountId);
            return projects.map((project): IHubAdminProject => ({
                type: EntryType.Project,
                id: project.id!,
                accountId,
                name: project.name || '',
                authContext: this._authContext
            })).sort(stringPropertySorter('name'));
        } catch (err) {
            showErrorMessage(`Could not list hub admin projects`, err);
            return [];
        }
    }

    private async _getProjectUsers(projectId: string): Promise<IHubAdminProjectUser[]> {
        try {
            const projectUsers = await hubAdminServiceFor(this._context, this._authContext).getProjectUsers(projectId);
            return projectUsers.map((projectUser): IHubAdminProjectUser => ({
                type: EntryType.ProjectUser,
                id: projectUser.id!,
                projectId,
                name: projectUser.name || '',
                email: projectUser.email || '',
                authContext: this._authContext
            })).sort(stringPropertySorter('name'));
        } catch (err) {
            showErrorMessage(`Could not list project users`, err);
            return [];
        }
    }

    private async _getCompanies(accountId: string): Promise<IHubAdminCompany[]> {
        try {
            const companies = await hubAdminServiceFor(this._context, this._authContext).getCompanies(accountId);
            return companies.map((company): IHubAdminCompany => ({
                type: EntryType.Company,
                id: company.id!,
                accountId,
                name: company.name || '',
                authContext: this._authContext
            })).sort(stringPropertySorter('name'));
        } catch (err) {
            showErrorMessage(`Could not list hub admin companies`, err);
            return [];
        }
    }
}
