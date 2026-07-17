import { AdminClient, Company, Project, ProjectUser, User } from '@aps_sdk/construction-account-admin';

/**
 * Domain logic for the (read-only) Hub Admin API surface. Wraps an `AdminClient` and exposes plain
 * domain-shaped operations so the vscode layers never touch the SDK's client or response shapes.
 * The client itself may be backed by either 2-legged (app) or 3-legged (user) credentials - see
 * `hubAdminServiceApp`/`hubAdminServiceUser` in `services/index.ts` - so this class stays agnostic of
 * which auth context it is serving.
 */
export class HubAdminService {
    constructor(private readonly client: AdminClient) {}

    /** Lists the users in the account's member directory. */
    getUsers(accountId: string): Promise<User[]> {
        return this.client.getUsers(accountId, { limit: 100 });
    }

    getUser(accountId: string, userId: string): Promise<User> {
        return this.client.getUser(accountId, userId);
    }

    /** Lists the projects in the account. */
    async getProjects(accountId: string): Promise<Project[]> {
        const projects = await this.client.getProjects(accountId, { limit: 200 });
        return projects.results ?? [];
    }

    getProject(projectId: string): Promise<Project> {
        return this.client.getProject(projectId);
    }

    /** Lists the users assigned to a project. */
    async getProjectUsers(projectId: string): Promise<ProjectUser[]> {
        const projectUsers = await this.client.getProjectUsers(projectId, { limit: 200 });
        return projectUsers.results ?? [];
    }

    getProjectUser(projectId: string, userId: string): Promise<ProjectUser> {
        return this.client.getProjectUser(projectId, userId);
    }

    /** Lists the partner companies in the account's company directory. */
    getCompanies(accountId: string): Promise<Company[]> {
        return this.client.getCompanies(accountId, { limit: 100 });
    }

    getCompany(companyId: string, accountId: string): Promise<Company> {
        return this.client.getCompany(companyId, accountId);
    }
}
