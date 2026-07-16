import * as vscode from 'vscode';
import { IContext } from '../common';
import { IHub, IProject, IHint } from '../models/hubs';
import { IIssue } from '../models/issues';

type IssuesEntry = IHub | IProject | IIssue | IHint;

function isHub(entry: IssuesEntry): entry is IHub {
    return (<IHub>entry).kind === 'hub';
}

function isProject(entry: IssuesEntry): entry is IProject {
    return (<IProject>entry).kind === 'project';
}

function isIssue(entry: IssuesEntry): entry is IIssue {
    return (<IIssue>entry).kind === 'issue';
}

export class IssuesDataProvider implements vscode.TreeDataProvider<IssuesEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<IssuesEntry | null> = new vscode.EventEmitter<IssuesEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<IssuesEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: IssuesEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: IssuesEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isHub(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.id;
            node.tooltip = [
                `Hub`,
                `ID: ${entry.id}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'hub';
            return node;
        } else if (isProject(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.id;
            node.tooltip = [
                `Project`,
                `ID: ${entry.id}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'project';
            return node;
        } else if (isIssue(entry)) {
            const node = new vscode.TreeItem(`#${entry.displayId} ${entry.title}`, vscode.TreeItemCollapsibleState.None);
            node.id = entry.id;
            node.description = entry.status;
            node.tooltip = [
                `Issue`,
                `ID: ${entry.id}`,
                `Display ID: ${entry.displayId}`,
                `Title: ${entry.title}`,
                `Status: ${entry.status}`,
                `Assigned to: ${entry.assignedTo || '<none>'}`,
                `Due date: ${entry.dueDate || '<none>'}`
            ].join('\n');
            node.contextValue = 'issue';
            return node;
        } else {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = entry.hint;
            node.tooltip = entry.tooltip;
            node.contextValue = 'hint';
            return node;
        }
    }

    async getChildren(entry?: IssuesEntry | undefined): Promise<IssuesEntry[]> {
        if (!entry) {
            // No user session -> return nothing so the "Sign in to APS" welcome view is shown instead.
            if (!this._context.session) {
                return [];
            }
            return this._getHubs();
        } else if (isHub(entry)) {
            return this._getProjects(entry.id);
        } else if (isProject(entry)) {
            return this._getIssues(entry.id);
        } else {
            return [];
        }
    }

    async _getHubs(): Promise<IssuesEntry[]> {
        try {
            return await this._context.hubsService.getHubs();
        } catch (err) {
            return [{
                hint: 'Could not retrieve hubs.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getProjects(hubId: string): Promise<IssuesEntry[]> {
        try {
            return await this._context.hubsService.getProjects(hubId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve projects.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getIssues(projectId: string): Promise<IssuesEntry[]> {
        try {
            return await this._context.issuesService.getIssues(projectId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve issues.',
                tooltip: 'An error occurred while retrieving data from the Issues API.'
            }];
        }
    }
}
