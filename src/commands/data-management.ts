import * as vscode from 'vscode';
import { IContext } from '../common';
import { IHub, IProject, IFolder, IItem, IVersion } from '../interfaces/hubs';
import { CommandCategory, Command, CommandRegistry, ViewItemContextMenu } from './shared';

@CommandCategory({ category: 'Autodesk Platform Services > Data Management', prefix: 'aps.dm' })
export class DataManagementCommands extends CommandRegistry {
    constructor(protected context: IContext, protected refresh: () => void) {
        super();
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    @Command({ title: 'Copy Hub ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsHubsView && viewItem == hub', group: '0_view@1' })
	async copyHubID(hub?: IHub) {
        hub = this.ensureInput(hub);
        await vscode.env.clipboard.writeText(hub.id);
        vscode.window.showInformationMessage(`Hub ID copied to clipboard: ${hub.id}`);
	}

    @Command({ title: 'Copy Project ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsHubsView && viewItem == project', group: '0_view@1' })
	async copyProjectID(project?: IProject) {
        project = this.ensureInput(project);
		await vscode.env.clipboard.writeText(project.id);
		vscode.window.showInformationMessage(`Project ID copied to clipboard: ${project.id}`);
	}

    @Command({ title: 'Copy Folder ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsHubsView && viewItem == folder', group: '0_view@1' })
	async copyFolderID(folder?: IFolder) {
        folder = this.ensureInput(folder);
        await vscode.env.clipboard.writeText(folder.id);
        vscode.window.showInformationMessage(`Folder ID copied to clipboard: ${folder.id}`);
	}

    @Command({ title: 'Copy Item ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsHubsView && viewItem == item', group: '0_view@1' })
	async copyItemID(item?: IItem) {
        item = this.ensureInput(item);
        await vscode.env.clipboard.writeText(item.id);
        vscode.window.showInformationMessage(`Item ID copied to clipboard: ${item.id}`);
	}

    @Command({ title: 'Copy Version ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsHubsView && viewItem == version', group: '0_view@1' })
	async copyVersionID(version?: IVersion) {
        version = this.ensureInput(version);
        await vscode.env.clipboard.writeText(version.id);
        vscode.window.showInformationMessage(`Version ID copied to clipboard: ${version.id}`);
	}
}
