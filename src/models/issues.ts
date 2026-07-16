// Re-export the Issues SDK types the vscode layers (commands/providers/webviews) need for the full
// issue detail view, so those layers depend on `src/models` instead of importing
// `@aps_sdk/construction-issues` directly.
export type { Issue } from '@aps_sdk/construction-issues';
export type { CommentsResults as IssueComment } from '@aps_sdk/construction-issues';

export interface IIssue {
    kind: 'issue';
    projectId: string;
    id: string;
    displayId: number;
    title: string;
    status: string;
    assignedTo?: string;
    dueDate?: string;
}
