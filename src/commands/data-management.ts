import * as vscode from 'vscode';
import { IContext } from '../common';
import { IHub, IProject, IFolder, IItem, IVersion } from '../models/hubs';

export class DataManagementCommands {
    constructor(protected context: IContext, protected refresh: () => void, protected onLoadMore: (parentId: string) => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.dm.loadMore', this.loadMore.bind(this)),
            vscode.commands.registerCommand('aps.dm.copyHubID', this.copyHubID.bind(this)),
            vscode.commands.registerCommand('aps.dm.copyProjectID', this.copyProjectID.bind(this)),
            vscode.commands.registerCommand('aps.dm.copyFolderID', this.copyFolderID.bind(this)),
            vscode.commands.registerCommand('aps.dm.copyItemID', this.copyItemID.bind(this)),
            vscode.commands.registerCommand('aps.dm.copyVersionID', this.copyVersionID.bind(this)),
        ];
    }

    async loadMore(parentId: string) {
        this.onLoadMore(parentId);
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

	async copyHubID(hub?: IHub) {
        hub = this.ensureInput(hub);
        await vscode.env.clipboard.writeText(hub.id);
        vscode.window.showInformationMessage(`Hub ID copied to clipboard: ${hub.id}`);
	}

	async copyProjectID(project?: IProject) {
        project = this.ensureInput(project);
		await vscode.env.clipboard.writeText(project.id);
		vscode.window.showInformationMessage(`Project ID copied to clipboard: ${project.id}`);
	}

	async copyFolderID(folder?: IFolder) {
        folder = this.ensureInput(folder);
        await vscode.env.clipboard.writeText(folder.id);
        vscode.window.showInformationMessage(`Folder ID copied to clipboard: ${folder.id}`);
	}

	async copyItemID(item?: IItem) {
        item = this.ensureInput(item);
        await vscode.env.clipboard.writeText(item.id);
        vscode.window.showInformationMessage(`Item ID copied to clipboard: ${item.id}`);
	}

	async copyVersionID(version?: IVersion) {
        version = this.ensureInput(version);
        await vscode.env.clipboard.writeText(version.id);
        vscode.window.showInformationMessage(`Version ID copied to clipboard: ${version.id}`);
	}
}
