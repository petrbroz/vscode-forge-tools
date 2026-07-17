import * as vscode from 'vscode';
import { BucketsItems, ObjectDetails } from '../models/oss';
import { Manifest, IDerivative } from '../models/model-derivative';
import { urnify } from '../urn';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';

export interface IHint {
    hint: string;
    tooltip?: string;
}

/** Synthetic leaf shown after a partial page of buckets/objects, to fetch the next page on click. */
export interface ILoadMore {
    loadMore: true;
    /** Key of the parent whose next page this loads: {@link SimpleStorageDataProvider.rootKey} for the bucket list, or a bucket key for that bucket's object list. */
    parentKey: string;
}

type SimpleStorageEntry = BucketsItems | ObjectDetails | IDerivative | IHint | ILoadMore;

function isBucket(entry: SimpleStorageEntry): entry is BucketsItems {
    return (<BucketsItems>entry).policyKey !== undefined;
}

function isObject(entry: SimpleStorageEntry): entry is ObjectDetails {
    return (<ObjectDetails>entry).objectId !== undefined;
}

function isDerivative(entry: SimpleStorageEntry): entry is IDerivative {
    return (<IDerivative>entry).guid !== undefined;
}

function isLoadMore(entry: SimpleStorageEntry): entry is ILoadMore {
    return (<ILoadMore>entry).loadMore === true;
}

function isHint(entry: SimpleStorageEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

export class SimpleStorageDataProvider implements vscode.TreeDataProvider<SimpleStorageEntry>, vscode.TreeDragAndDropController<SimpleStorageEntry> {
    /** Key used for the bucket list's page/continuation-token cache (the object list uses its bucket key instead). */
    static readonly rootKey = 'root';

    /** Accepts files dropped from outside VS Code (e.g. the OS file explorer); see {@link handleDrop}. */
    readonly dropMimeTypes = ['text/uri-list'];
    /** This tree doesn't act as a drag source. */
    readonly dragMimeTypes: readonly string[] = [];

    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<SimpleStorageEntry | null> = new vscode.EventEmitter<SimpleStorageEntry | null>();
    /** Buckets/objects already fetched per parent (see {@link rootKey}), so "load more" only fetches the next page. */
    private _loadedItems = new Map<string, (BucketsItems | ObjectDetails)[]>();
    /** Continuation token for each parent's next page, if any more remain. */
    private _nextStartAt = new Map<string, string>();
    /** Active `beginsWith` prefix filter per bucket key, if the user has set one. */
    private _filters = new Map<string, string>();

	readonly onDidChangeTreeData?: vscode.Event<SimpleStorageEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: SimpleStorageEntry) {
        if (!entry) {
            this._loadedItems.clear();
            this._nextStartAt.clear();
        }
        this._onDidChangeTreeData.fire(entry || null);
    }

    /** The active `beginsWith` prefix filter for a bucket's object list, if any. */
    getFilter(bucketKey: string): string | undefined {
        return this._filters.get(bucketKey);
    }

    /** Sets (or, if `prefix` is falsy, clears) a bucket's object filter and refreshes its node. */
    setFilter(bucketKey: string, prefix: string | undefined) {
        if (prefix) {
            this._filters.set(bucketKey, prefix);
        } else {
            this._filters.delete(bucketKey);
        }
        this._loadedItems.delete(bucketKey);
        this._nextStartAt.delete(bucketKey);
        this._fireChangeForBucket(bucketKey);
    }

    /** Fetches the next page for the given parent (see {@link rootKey}) and refreshes just that node. */
    async loadMore(parentKey: string) {
        try {
            const startAt = this._nextStartAt.get(parentKey);
            if (!startAt) {
                return;
            }
            const loaded = this._loadedItems.get(parentKey) ?? [];
            const isRoot = parentKey === SimpleStorageDataProvider.rootKey;
            const page = isRoot
                ? await this._context.ossService.getBucketsPage({ startAt, limit: this._pageSize() })
                : await this._context.ossService.getObjectsPage(parentKey, { startAt, limit: this._pageSize(), beginsWith: this._filters.get(parentKey) });
            this._loadedItems.set(parentKey, [...loaded, ...page.items]);
            if (page.nextStartAt) {
                this._nextStartAt.set(parentKey, page.nextStartAt);
            } else {
                this._nextStartAt.delete(parentKey);
            }
            if (isRoot) {
                this._onDidChangeTreeData.fire(null);
            } else {
                this._fireChangeForBucket(parentKey);
            }
        } catch(err) {
            showErrorMessage(`Could not load more items`, err);
        }
    }

    /** Uploads files dropped (from the OS file explorer) onto a bucket node, via the {@link vscode.TreeDragAndDropController} API. */
    async handleDrop(target: SimpleStorageEntry | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (!target || !isBucket(target)) {
            return;
        }
        const item = dataTransfer.get('text/uri-list');
        if (!item) {
            return;
        }
        const uris = (await item.asString())
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => vscode.Uri.parse(line))
            .filter(uri => uri.scheme === 'file');
        const fileUris: vscode.Uri[] = [];
        for (const uri of uris) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.File) {
                    fileUris.push(uri);
                }
            } catch {
                // Skip entries that can no longer be accessed.
            }
        }
        if (fileUris.length === 0) {
            return;
        }
        await vscode.commands.executeCommand('aps.oss.uploadObject', target, fileUris);
    }

    /** Fires a change event for the bucket node with the given key, falling back to a full refresh if it isn't loaded (yet). */
    private _fireChangeForBucket(bucketKey: string) {
        const bucket = (this._loadedItems.get(SimpleStorageDataProvider.rootKey) as BucketsItems[] | undefined)?.find(b => b.bucketKey === bucketKey);
        this._onDidChangeTreeData.fire(bucket ?? null);
    }

    /** Reads `autodesk.forge.data.pageSize` and clamps it to the API's accepted 1-100 range. */
    private _pageSize(): number {
        const configured = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.data.pageSize', 100);
        return Math.min(100, Math.max(1, configured));
    }

    getTreeItem(element: SimpleStorageEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isBucket(element)) {
            const filter = this._filters.get(element.bucketKey);
            const node = new vscode.TreeItem(element.bucketKey, vscode.TreeItemCollapsibleState.Collapsed);
            node.description = filter ? `filter: ${filter}` : undefined;
            node.tooltip = [
                `Bucket`,
                `Key: ${element.bucketKey}`,
                `Policy: ${element.policyKey}`,
                ...(filter ? [`Filter: ${filter}`] : [])
            ].join('\n');
            node.contextValue = filter ? 'bucket-filtered' : 'bucket';
            node.iconPath = new vscode.ThemeIcon('folder');
            return node;
        } else if (isObject(element)) {
            const node = new vscode.TreeItem(element.objectKey!, vscode.TreeItemCollapsibleState.Collapsed);
            node.tooltip = [
                `Object`,
                `Key: ${element.objectKey}`,
                `ID: ${element.objectId}`,
                `Size: ${element.size} bytes`
            ].join('\n');
            node.contextValue = 'object';
            node.iconPath = new vscode.ThemeIcon('file');
            return node;
        } else if (isDerivative(element)) {
            const node = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
            node.tooltip = [
                `Derivative`,
                `Name: ${element.name}`,
                `Format: ${element.format}`,
                `Role: ${element.role}`
            ].join('\n');
            node.contextValue = element.nonViewable ? 'non-viewable-derivative' : 'derivative';
            node.iconPath = new vscode.ThemeIcon('file-binary');
            return node;
        } else if (isLoadMore(element)) {
            const node = new vscode.TreeItem('Load more…', vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'load-more';
            node.iconPath = new vscode.ThemeIcon('ellipsis');
            node.command = { command: 'aps.oss.loadMore', title: 'Load more', arguments: [element.parentKey] };
            return node;
        } else {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = element.hint;
            node.tooltip = element.tooltip;
            node.contextValue = 'hint';
            return node;
        }
    }

    async getChildren(element?: SimpleStorageEntry | undefined): Promise<SimpleStorageEntry[]> {
        try {
            if (element) {
                if (isBucket(element)) {
                    return await this._getPage(element.bucketKey, 'objectKey', () => this._context.ossService.getObjectsPage(element.bucketKey, { limit: this._pageSize(), beginsWith: this._filters.get(element.bucketKey) }));
                } else if (isObject(element)) {
                    const urn = urnify(element.objectId!);
                    try {
                        const manifest = await this._context.modelDerivativeService.getManifest(urn);
                        switch (manifest.status) {
                            case 'success':
                                const derivatives = await this._context.modelDerivativeService.getManifestDerivatives(manifest, urn);
                                return derivatives.sort(stringPropertySorter('name'));
                            case 'failed':
                                return [this._getManifestErrorHint(manifest, urn)];
                            default:
                                // If still in progress, schedule auto-refresh in 1 second
                                setTimeout(() => { this.refresh(element); }, 1000);
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
            } else {
                return await this._getPage(SimpleStorageDataProvider.rootKey, 'bucketKey', () => this._context.ossService.getBucketsPage({ limit: this._pageSize() }));
            }
        } catch(err) {
            showErrorMessage(`Could not load objects or buckets`, err);
        }
        return [];
    }

    /**
     * Returns the currently loaded items for `key` (fetching the first page on first access), sorted,
     * plus a trailing {@link ILoadMore} entry if more pages remain.
     */
    private async _getPage<T extends BucketsItems | ObjectDetails>(key: string, sortField: keyof T, fetchFirstPage: () => Promise<{ items: T[]; nextStartAt?: string }>): Promise<SimpleStorageEntry[]> {
        if (!this._loadedItems.has(key)) {
            const page = await fetchFirstPage();
            this._loadedItems.set(key, page.items);
            if (page.nextStartAt) {
                this._nextStartAt.set(key, page.nextStartAt);
            }
        }
        const items = (this._loadedItems.get(key) as T[]).sort(stringPropertySorter(sortField));
        const nextStartAt = this._nextStartAt.get(key);
        return nextStartAt ? [...items, { loadMore: true, parentKey: key }] : items;
    }

    private _getManifestErrorHint(manifest: any, urn: string): IHint {
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

    private _getManifestProgressHint(manifest: Manifest, urn: string): IHint {
        return { hint: `Translation in progress (${manifest.progress})` };
    }
}
