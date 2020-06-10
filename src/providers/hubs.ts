import * as vscode from 'vscode';
import {
    urnify as _urnify
} from 'forge-server-utils';
import { IDerivative } from '../interfaces/model-derivative';
import { IContext, inHubs } from '../common';

function urnify(id: string): string {
    return _urnify(id).replace('/', '_');
}

export interface IHint {
    hint: string;
    tooltip?: string;
}

export interface IHub {
    kind: 'hub';
    id: string;
    name: string;
}

export interface IProject {
    kind: 'project';
    hubId: string;
    id: string;
    name: string;
}

export interface IFolder {
    kind: 'folder';
    projectId: string;
    id: string;
    name: string;
}

export interface IItem {
    kind: 'item';
    projectId: string;
    id: string;
    name: string;
}

export interface IVersion {
    kind: 'version';
    itemId: string;
    id: string;
    name: string;
}

type HubsEntry = IHub | IProject | IFolder | IItem | IVersion | IDerivative | IHint;

function isHub(entry: HubsEntry): entry is IHub {
    return (<IHub>entry).kind === 'hub';
}

function isProject(entry: HubsEntry): entry is IProject {
    return (<IProject>entry).kind === 'project';
}

function isFolder(entry: HubsEntry): entry is IFolder {
    return (<IFolder>entry).kind === 'folder';
}

function isItem(entry: HubsEntry): entry is IItem {
    return (<IItem>entry).kind === 'item';
}

function isVersion(entry: HubsEntry): entry is IVersion {
    return (<IVersion>entry).kind === 'version';
}

function isDerivative(entry: HubsEntry): entry is IDerivative {
    return (<IDerivative>entry).guid !== undefined;
}

function isHint(entry: HubsEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

export class HubsDataProvider implements vscode.TreeDataProvider<HubsEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<HubsEntry | null> = new vscode.EventEmitter<HubsEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<HubsEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: HubsEntry | null) {
        this._onDidChangeTreeData.fire(entry);
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
            return this._getVersionDerivatives(entry.id);
        } else {
            return [];
        }
    }

    async _getHubs(): Promise<HubsEntry[]> {
        try {
            const hubs = await this._context.bim360Client.listHubs();
            return hubs.map(hub => {
                let entry: IHub = {
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
                let entry: IProject = {
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
                let entry: IFolder = {
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
                        let folder: IFolder = {
                            kind: 'folder',
                            projectId,
                            id: item.id,
                            name: (item as any).displayName || '<no name>'
                        };
                        return folder;
                    case 'items':
                        let file: IItem = {
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
                let entry: IVersion = {
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

    async _getVersionDerivatives(versionId: string): Promise<(IDerivative | IHint)[]> {
        try {
            const urn = urnify(versionId);
            const client = this._context.threeLeggedToken
                ? this._context.modelDerivativeClient3L
                : this._context.modelDerivativeClient2L
            const manifest = await client.getManifest(urn);
            if (manifest.status !== 'success') {
                throw new Error('Unexpected manifest status: ' + manifest.status);
            }
            const svf = manifest.derivatives.find((deriv: any) => deriv.outputType === 'svf');
            if (!svf || !svf.children) {
                return [];
            } else {
                return svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
                    return {
                        urn,
                        name: geometry.name,
                        role: geometry.role,
                        guid: geometry.guid,
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
}
