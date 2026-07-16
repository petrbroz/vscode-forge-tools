import * as vscode from 'vscode';
import { Manifest, IDerivative } from '../models/model-derivative';
import { IContext, showErrorMessage } from '../common';
import * as hi from '../models/hubs';

type HubsEntry = hi.IHub | hi.IProject | hi.IFolder | hi.IItem | hi.IVersion | IDerivative | hi.IHint | hi.ILoadMore;

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

function isLoadMore(entry: HubsEntry): entry is hi.ILoadMore {
    return (<hi.ILoadMore>entry).loadMore === true;
}

function isHint(entry: HubsEntry): entry is hi.IHint {
    return (<hi.IHint>entry).hint !== undefined;
}

export class HubsDataProvider implements vscode.TreeDataProvider<HubsEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<HubsEntry | null> = new vscode.EventEmitter<HubsEntry | null>();
    /** Projects/folder-contents/item-versions already fetched per parent ID, so "load more" only fetches the next page. */
    private _loadedItems = new Map<string, HubsEntry[]>();
    /** Next page number for each parent's next page, if any more remain. */
    private _nextPageNumber = new Map<string, number>();
    /** The hub/folder/item entry behind each parent ID above, so {@link loadMore} knows which API to call next. */
    private _parents = new Map<string, hi.IHub | hi.IFolder | hi.IItem>();

    readonly onDidChangeTreeData?: vscode.Event<HubsEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: HubsEntry) {
        if (!entry) {
            this._loadedItems.clear();
            this._nextPageNumber.clear();
            this._parents.clear();
        }
        this._onDidChangeTreeData.fire(entry || null);
    }

    /** Fetches the next page for the given parent ID and refreshes just that node. */
    async loadMore(parentId: string) {
        try {
            const pageNumber = this._nextPageNumber.get(parentId);
            if (pageNumber === undefined) {
                return;
            }
            const parent = this._parents.get(parentId);
            if (!parent) {
                return;
            }
            const loaded = this._loadedItems.get(parentId) ?? [];
            const page = isHub(parent)
                ? await this._context.hubsService.getProjectsPage(parent.id, pageNumber, this._pageSize())
                : isFolder(parent)
                ? await this._context.hubsService.getFolderContentsPage(parent.projectId, parent.id, pageNumber, this._pageSize())
                : await this._context.hubsService.getItemVersionsPage(parent.projectId, parent.id, pageNumber, this._pageSize());
            this._loadedItems.set(parentId, [...loaded, ...page.items]);
            if (page.nextPageNumber !== undefined) {
                this._nextPageNumber.set(parentId, page.nextPageNumber);
            } else {
                this._nextPageNumber.delete(parentId);
            }
            this._onDidChangeTreeData.fire(parent);
        } catch(err) {
            showErrorMessage(`Could not load more items`, err);
        }
    }

    /** Reads `autodesk.forge.data.hubsPageSize` and clamps it to the Data Management API's accepted 1-200 range. */
    private _pageSize(): number {
        const configured = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.data.hubsPageSize', 200);
        return Math.min(200, Math.max(1, configured));
    }

    /**
     * Returns the currently loaded items for `parent` (fetching the first page on first access), plus
     * a trailing {@link hi.ILoadMore} entry if more pages remain.
     */
    private async _getPage<T extends HubsEntry>(parent: hi.IHub | hi.IFolder | hi.IItem, fetchFirstPage: () => Promise<hi.IPage<T>>): Promise<HubsEntry[]> {
        const key = parent.id;
        if (!this._loadedItems.has(key)) {
            const page = await fetchFirstPage();
            this._loadedItems.set(key, page.items);
            this._parents.set(key, parent);
            if (page.nextPageNumber !== undefined) {
                this._nextPageNumber.set(key, page.nextPageNumber);
            }
        }
        const items = this._loadedItems.get(key)!;
        const nextPageNumber = this._nextPageNumber.get(key);
        return nextPageNumber !== undefined ? [...items, { loadMore: true, parentId: key }] : items;
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
        } else if (isLoadMore(entry)) {
            const node = new vscode.TreeItem('Load more…', vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'load-more';
            node.iconPath = new vscode.ThemeIcon('ellipsis');
            node.command = { command: 'aps.dm.loadMore', title: 'Load more', arguments: [entry.parentId] };
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
            // No user session -> return nothing so the "Sign in to APS" welcome view is shown instead.
            if (!this._context.session) {
                return [];
            }
            return this._getHubs();
        } else if (isHub(entry)) {
            return this._getProjects(entry);
        } else if (isProject(entry)) {
            return this._getTopFolders(entry.hubId, entry.id);
        } else if (isFolder(entry)) {
            return this._getFolderContents(entry);
        } else if (isItem(entry)) {
            return this._getItemVersions(entry);
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
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getProjects(hub: hi.IHub): Promise<HubsEntry[]> {
        try {
            return await this._getPage(hub, () => this._context.hubsService.getProjectsPage(hub.id, undefined, this._pageSize()));
        } catch (err) {
            return [{
                hint: 'Could not retrieve projects.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getTopFolders(hubId: string, projectId: string): Promise<HubsEntry[]> {
        try {
            return await this._context.hubsService.getTopFolders(hubId, projectId);
        } catch (err) {
            return [{
                hint: 'Could not retrieve top-level folders.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getFolderContents(folder: hi.IFolder): Promise<HubsEntry[]> {
        try {
            return await this._getPage(folder, () => this._context.hubsService.getFolderContentsPage(folder.projectId, folder.id, undefined, this._pageSize()));
        } catch (err) {
            return [{
                hint: 'Could not retrieve folder contents.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getItemVersions(item: hi.IItem): Promise<HubsEntry[]> {
        try {
            return await this._getPage(item, () => this._context.hubsService.getItemVersionsPage(item.projectId, item.id, undefined, this._pageSize()));
        } catch (err) {
            return [{
                hint: 'Could not retrieve item versions.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
            }];
        }
    }

    async _getVersionDerivatives(versionId: string, manifest?: Manifest): Promise<(IDerivative | hi.IHint)[]> {
        try {
            return await this._context.hubsService.getVersionDerivatives(versionId, manifest);
        } catch (err) {
            return [{
                hint: 'Could not retrieve derivatives.',
                tooltip: 'An error occurred while retrieving data from the Data Management API.'
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
