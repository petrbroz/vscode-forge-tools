import { IssuesClient, Issue } from '@aps_sdk/construction-issues';
import { IIssue, IssueComment } from '../models/issues';

/**
 * Domain logic for ACC/BIM 360 issues. Wraps an `IssuesClient` (always running in a user context -
 * the Issues API has no app-only mode) and exposes plain, domain-shaped operations so the vscode
 * layers never touch the SDK's client or response shapes.
 */
export class IssuesService {
    constructor(private readonly client: IssuesClient) {}

    /**
     * Lists the issues of a project. `projectId` is the Data Management hub project ID
     * (`b.<guid>`); the Issues API expects the bare GUID, so the `b.` prefix is stripped here.
     */
    async getIssues(projectId: string): Promise<IIssue[]> {
        const containerId = projectId.replace(/^b\./, '');
        const page = await this.client.getIssues(containerId);
        return (page.results ?? []).map(issue => ({
            kind: 'issue',
            projectId: containerId,
            id: issue.id!,
            displayId: issue.displayId!,
            title: issue.title || '<no title>',
            status: issue.status || '<no status>',
            assignedTo: issue.assignedTo,
            dueDate: issue.dueDate
        }));
    }

    /** Fetches the full details of a single issue (`projectId` is the already-stripped container GUID, as returned on `IIssue`). */
    getIssueDetails(projectId: string, issueId: string): Promise<Issue> {
        return this.client.getIssueDetails(projectId, issueId);
    }

    /** Fetches all comments of a single issue (`projectId` is the already-stripped container GUID, as returned on `IIssue`). */
    async getIssueComments(projectId: string, issueId: string): Promise<IssueComment[]> {
        const comments = await this.client.getComments(projectId, issueId);
        return comments.results ?? [];
    }
}
