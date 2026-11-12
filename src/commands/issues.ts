import * as vscode from 'vscode';
import { IContext, command, showReadOnlyJson, withProgress } from '../common';
import { IIssue } from '../models/issues';

export class IssuesCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.issues.viewIssueDetails', 'Could not access issue', this.viewIssueDetails.bind(this)),
            command(this.context, 'aps.issues.copyIssueID', this.copyIssueID.bind(this)),
        ];
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async viewIssueDetails(issue?: IIssue) {
        issue = this.ensureInput(issue);
        const { projectId, id, displayId } = issue;
        const [detail, comments] = await withProgress(`Getting issue details: #${displayId}`, Promise.all([
            this.context.issuesService.getIssueDetails(projectId, id),
            this.context.issuesService.getIssueComments(projectId, id)
        ]));
        await showReadOnlyJson(this.context, ['issues', projectId, id], { ...detail, comments });
    }

    async copyIssueID(issue?: IIssue) {
        issue = this.ensureInput(issue);
        await vscode.env.clipboard.writeText(issue.id);
        vscode.window.showInformationMessage(`Issue ID copied to clipboard: ${issue.id}`);
    }
}
