import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { IIssue } from '../models/issues';

export class IssuesCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.issues.viewIssueDetails', this.viewIssueDetails.bind(this)),
            vscode.commands.registerCommand('aps.issues.copyIssueID', this.copyIssueID.bind(this)),
        ];
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async viewIssueDetails(issue?: IIssue) {
        try {
            issue = this.ensureInput(issue);
            const { projectId, id, displayId } = issue;
            const [detail, comments] = await withProgress(`Getting issue details: #${displayId}`, Promise.all([
                this.context.issuesService.getIssueDetails(projectId, id),
                this.context.issuesService.getIssueComments(projectId, id)
            ]));
            createWebViewPanel(this.context, 'details.js', 'details', `Issue Details: #${displayId}`, {
                title: `Issue Details: #${detail.displayId} ${detail.title}`,
                fields: [
                    { label: 'ID', value: detail.id },
                    { label: 'Display ID', value: (detail.displayId ?? '').toString() },
                    { label: 'Status', value: detail.status },
                    { label: 'Assigned To', value: detail.assignedTo || '<none>' },
                    { label: 'Assigned To Type', value: detail.assignedToType || '<none>' },
                    { label: 'Start Date', value: detail.startDate || '<none>' },
                    { label: 'Due Date', value: detail.dueDate || '<none>' },
                    { label: 'Location', value: detail.locationDetails || '<none>' },
                    { label: 'Created By', value: detail.createdBy || '<none>' },
                    { label: 'Created At', value: detail.createdAt || '<none>' },
                    { label: 'Updated By', value: detail.updatedBy || '<none>' },
                    { label: 'Updated At', value: detail.updatedAt || '<none>' },
                    { label: 'Closed By', value: detail.closedBy || '<none>' },
                    { label: 'Closed At', value: detail.closedAt || '<none>' },
                    { label: 'Comments', value: (detail.commentCount ?? 0).toString() },
                    { label: 'Watchers', value: (detail.watchers ?? []).join(', ') || '<none>' },
                    { label: 'Description', value: detail.description || '<no description>', multiline: true }
                ],
                tables: comments && comments.length > 0 ? [{
                    title: `Comments (${comments.length})`,
                    columns: ['Created By', 'Created At', 'Comment'],
                    columnWidths: '1fr 1fr 3fr',
                    rows: comments.map(comment => [comment.createdBy || '<unknown>', comment.createdAt || '', comment.body || ''])
                }] : undefined
            });
        } catch (err) {
            showErrorMessage('Could not access issue', err, this.context);
        }
    }

    async copyIssueID(issue?: IIssue) {
        issue = this.ensureInput(issue);
        await vscode.env.clipboard.writeText(issue.id);
        vscode.window.showInformationMessage(`Issue ID copied to clipboard: ${issue.id}`);
    }
}
