import * as vscode from 'vscode';
import {
	IBucket,
    IObject,
    IDerivativeManifest,
    urnify as _urnify
} from 'aps-sdk-node';
import { IDerivative } from '../interfaces/model-derivative';
import { IContext, inHubs } from '../common';
import * as hi from '../interfaces/hubs';
import { isViewableFormat } from './model-derivative';

function urnify(id: string): string {
    return _urnify(id).replace('/', '_');
}

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
            node.contextValue = 'hub';
            return node;
        } else if (isProject(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'project';
            return node;
        } else if (isFolder(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'folder';
            return node;
        } else if (isItem(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'item';
            return node;
        } else if (isVersion(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'version';
            return node;
        } else if (isDerivative(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'derivative';
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
            const urn = urnify(entry.id);
            try {
                const client = this._context.threeLeggedToken
                    ? this._context.modelDerivativeClient3L
                    : this._context.modelDerivativeClient2L;
                const manifest = await client.getManifest(urn);
                switch (manifest.status) {
                    case 'success':
                        return this._getVersionDerivatives(entry.id);
                    case 'failed':
                        return [this._getManifestErrorHint(manifest, urn)];
                    default:
                        // If still in progress, schedule auto-refresh in 1 second
                        setTimeout(() => { this.refresh(entry); }, 1000);
                        return [this._getManifestProgressHint(manifest, urn)];
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
            const hubs = await this._context.bim360Client.listHubs();
            return hubs.map(hub => {
                let entry: hi.IHub = {
                    kind: 'hub',
                    id: hub.id,
                    name: hub.name || '<no name>'
                };
                return entry;
            });
        } catch (err) {
            return [{
                hint: 'Could not retrieve hubs.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getProjects(hubId: string): Promise<HubsEntry[]> {
        try {
            const projects = await this._context.bim360Client.listProjects(hubId);
            return projects.map(project => {
                let entry: hi.IProject = {
                    kind: 'project',
                    hubId,
                    id: project.id,
                    name: project.name || '<no name>'
                };
                return entry;
            });
        } catch (err) {
            return [{
                hint: 'Could not retrieve projects.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getTopFolders(hubId: string, projectId: string): Promise<HubsEntry[]> {
        try {
            const folders = await this._context.bim360Client.listTopFolders(hubId, projectId);
            return folders.map(folder => {
                let entry: hi.IFolder = {
                    kind: 'folder',
                    projectId,
                    id: folder.id,
                    name: folder.displayName || '<no name>'
                };
                if (folder.hidden) {
                    entry.name = '(hidden) ' + entry.name;
                }
                return entry;
            });
        } catch (err) {
            return [{
                hint: 'Could not retrieve top-level folders.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getFolderContents(projectId: string, folderId: string): Promise<HubsEntry[]> {
        try {
            const items = await this._context.bim360Client.listContents(projectId, folderId);
            return items.map(item => {
                switch (item.type) {
                    case 'folders':
                        let folder: hi.IFolder = {
                            kind: 'folder',
                            projectId,
                            id: item.id,
                            name: (item as any).displayName || '<no name>'
                        };
                        return folder;
                    case 'items':
                        let file: hi.IItem = {
                            kind: 'item',
                            projectId,
                            id: item.id,
                            name: (item as any).displayName || '<no name>'
                        };
                        return file;
                    default:
                        throw new Error('Unexpected item type.');
                }
            });
        } catch (err) {
            return [{
                hint: 'Could not retrieve folder contents.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getItemVersions(projectId: string, itemId: string): Promise<HubsEntry[]> {
        try {
            const versions = await this._context.bim360Client.listVersions(projectId, itemId);
            return versions.map(version => {
                let entry: hi.IVersion = {
                    kind: 'version',
                    itemId,
                    id: version.id,
                    name: version.lastModifiedTime || version.createTime || '<no name>'
                };
                return entry;
            });
        } catch (err) {
            return [{
                hint: 'Could not retrieve item versions.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    async _getVersionDerivatives(versionId: string): Promise<(IDerivative | hi.IHint)[]> {
        try {
            const urn = urnify(versionId);
            const client = this._context.threeLeggedToken
                ? this._context.modelDerivativeClient3L
                : this._context.modelDerivativeClient2L;
            const manifest = await client.getManifest(urn);
            if (manifest.status !== 'success') {
                throw new Error('Unexpected manifest status: ' + manifest.status);
            }
            const svf = manifest.derivatives.find((deriv: any) => isViewableFormat(deriv.outputType));
            if (!svf || !svf.children) {
                return [];
            } else {
                return svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
                    return {
                        urn,
                        name: geometry.name,
                        role: geometry.role,
                        guid: geometry.guid,
                        format: svf.outputType!,
                        bubble: geometry
                    };
                });
            }
        } catch (err) {
            return [{
                hint: 'Could not retrieve derivatives.',
                tooltip: 'Try logging in with the 3-legged OAuth workflow.'
            }];
        }
    }

    private _getManifestErrorHint(manifest: any, urn: string): hi.IHint {
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

    private _getManifestProgressHint(manifest: IDerivativeManifest, urn: string): hi.IHint {
        return { hint: `Translation in progress (${manifest.progress})` };
    }
}
