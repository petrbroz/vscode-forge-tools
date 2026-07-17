export type { User as HubAdminUserDetails, Project as HubAdminProjectDetails, ProjectUser as HubAdminProjectUserDetails, Company as HubAdminCompanyDetails } from '@aps_sdk/construction-account-admin';

/** Which credentials back a Hub Admin tree node: the app's own (2-legged) or the active user session (3-legged). */
export type HubAdminAuthContext = 'app' | 'user';

export enum EntryType {
    Hub = 'hub-admin-hub',
    UsersCategory = 'hub-admin-users-category',
    ProjectsCategory = 'hub-admin-projects-category',
    CompaniesCategory = 'hub-admin-companies-category',
    User = 'hub-admin-user',
    Project = 'hub-admin-project',
    ProjectUsersCategory = 'hub-admin-project-users-category',
    ProjectUser = 'hub-admin-project-user',
    Company = 'hub-admin-company'
}

/** Root node of the Hub Admin tree; `accountId` is the hub ID with the "b." prefix removed. */
export interface IHubAdminHub {
    type: EntryType.Hub;
    id: string;
    accountId: string;
    name: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminUsersCategory {
    type: EntryType.UsersCategory;
    accountId: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminProjectsCategory {
    type: EntryType.ProjectsCategory;
    accountId: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminCompaniesCategory {
    type: EntryType.CompaniesCategory;
    accountId: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminUser {
    type: EntryType.User;
    id: string;
    accountId: string;
    name: string;
    email: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminProject {
    type: EntryType.Project;
    id: string;
    accountId: string;
    name: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminProjectUsersCategory {
    type: EntryType.ProjectUsersCategory;
    projectId: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminProjectUser {
    type: EntryType.ProjectUser;
    id: string;
    projectId: string;
    name: string;
    email: string;
    authContext: HubAdminAuthContext;
}

export interface IHubAdminCompany {
    type: EntryType.Company;
    id: string;
    accountId: string;
    name: string;
    authContext: HubAdminAuthContext;
}
