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
            createWebViewPanel(this.context, 'issue-details.js', 'issue-details', `Issue Details: #${displayId}`, { detail, comments });
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
