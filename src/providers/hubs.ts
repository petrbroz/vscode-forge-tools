import * as vscode from 'vscode';
import { Manifest, IDerivative } from '../models/model-derivative';
import { IContext } from '../common';
import * as hi from '../models/hubs';

type HubsEntry = hi.IHub | hi.IProject | hi.IFolder | hi.IItem | hi.IVersion | IDerivative | hi.IHint;

function isHub(entry: HubsEntry): entry is hi.IHub {
    return (<hi.IHub>entry).kind === 'hub';
}

function isProject(entry: HubsEntry): entry is hi.IProject {
    return (<hi.IProject>entry).kind === 'project';
}

function isFolder(entry: HubsEntry): entry is hi.IFolder {
    return (<hi.IFolder>entry).kind === 'folder';
}

function isItem(entry: HubsEntry): entry is hi.IItem {
    return (<hi.IItem>entry).kind === 'item';
}

function isVersion(entry: HubsEntry): entry is hi.IVersion {
    return (<hi.IVersion>entry).kind === 'version';
}

function isDerivative(entry: HubsEntry): entry is IDerivative {
    return (<IDerivative>entry).guid !== undefined;
}

function isHint(entry: HubsEntry): entry is hi.IHint {
    return (<hi.IHint>entry).hint !== undefined;
}

export class HubsDataProvider implements vscode.TreeDataProvider<HubsEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<HubsEntry | null> = new vscode.EventEmitter<HubsEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<HubsEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: HubsEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: HubsEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
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
        } else if (isFolder(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.id;
            node.tooltip = [
                `Folder`,
                `ID: ${entry.id}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'folder';
            return node;
        } else if (isItem(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.id;
            node.tooltip = [
                `Item`,
                `ID: ${entry.id}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'item';
            return node;
        } else if (isVersion(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.id;
            node.tooltip = [
                `Version`,
                `ID: ${entry.id}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'version';
            return node;
        } else if (isDerivative(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.None);
            node.id = entry.urn;
            node.tooltip = [
                `Derivative`,
                `Name: ${entry.name}`,
                `Format: ${entry.format}`,
                `Role: ${entry.role}`
            ].join('\n');
            node.iconPath = new vscode.ThemeIcon('file-binary');
            node.contextValue = entry.nonViewable ? 'non-viewable-derivative' : 'derivative';
            return node;
        } else {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = entry.hint;
            node.tooltip = entry.tooltip;
            node.contextValue = 'hint';
            return node;
        }
    }

    async getChildren(entry?: HubsEntry | undefined): Promise<HubsEntry[]> {
        if (!entry) {
            return this._getHubs();
        } else if (isHub(entry)) {
            return this._getProjects(entry.id);
        } else if (isProject(entry)) {
            return this._getTopFolders(entry.hubId, entry.id);
        } else if (isFolder(entry)) {
            return this._getFolderContents(entry.projectId, entry.id);
        } else if (isItem(entry)) {
            return this._getItemVersions(entry.projectId, entry.id);
        } else if (isVersion(entry)) {
            try {
                const manifest = await this._context.hubsService.getVersionManifest(entry.id);
                switch (manifest.status) {
                    case 'success':
                        return this._getVersionDerivatives(entry.id, manifest);
                    case 'failed':
                        return [this._getManifestErrorHint(manifest)];
                    default:
                        // If still in progress, schedule auto-refresh in 1 second
                        setTimeout(() => { this.refresh(entry); }, 1000);
                        return [this._getManifestProgressHint(manifest)];
                }
            } catch(err) {
                return [{
                    hint: 'No derivatives yet (hover for more info)',
                    tooltip: 'There don\'t seem to be any derivatives yet.\nTry triggering a new translation job on the object.'
                }];
            }
        } else {
            return [];
        }
    }

    async _getHubs(): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getHubs();
        } catch (err) {
            return [{
                hint: 'Could not retrieve hubs.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getProjects(hubId: string): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getProjects(hubId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve projects.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getTopFolders(hubId: string, projectId: string): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getTopFolders(hubId, projectId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve top-level folders.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getFolderContents(projectId: string, folderId: string): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getFolderContents(projectId, folderId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve folder contents.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getItemVersions(projectId: string, itemId: string): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getItemVersions(projectId, itemId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve item versions.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getVersionDerivatives(versionId: string, manifest?: Manifest): Promise<(IDerivative | hi.IHint)[]> {
        try {
            return await this._context.hubsService.getVersionDerivatives(versionId, manifest);
        } catch (err) {
            return [{
                hint: 'Could not retrieve derivatives.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    private _getManifestErrorHint(manifest: any): hi.IHint {
        const failed = manifest.derivatives.find((deriv: any) => deriv.status === 'failed');
        if (failed && failed.messages) {
            return {
                hint: 'Translation failed (hover for more info)',
                tooltip: failed.messages.map((message: any) => message.code + ':\n' + message.message).join('\n\n')
            };
        } else {
            return {
                hint:'Translation failed (hover for more info)',
                tooltip: 'Oops, there\'s no more info :('
            };
        }
    }

    private _getManifestProgressHint(manifest: Manifest): hi.IHint {
        return { hint: `Translation in progress (${manifest.progress})` };
    }
}
