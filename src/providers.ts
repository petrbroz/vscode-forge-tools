import * as vscode from 'vscode';
import { DataManagementClient, IBucket, IObject } from 'forge-nodejs-utils';

type SimpleStorageEntry = IBucket | IObject;

function isBucket(entry: SimpleStorageEntry): entry is IBucket {
    return (<IBucket>entry).policyKey !== undefined;
}

function isObject(entry: SimpleStorageEntry): entry is IObject {
    return (<IObject>entry).objectId !== undefined;
}

export class SimpleStorageDataProvider implements vscode.TreeDataProvider<SimpleStorageEntry> {
    private _client: DataManagementClient;
    private _onDidChangeTreeData: vscode.EventEmitter<SimpleStorageEntry | null> = new vscode.EventEmitter<SimpleStorageEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<SimpleStorageEntry | null> = this._onDidChangeTreeData.event;

    constructor(client: DataManagementClient) {
        this._client = client;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SimpleStorageEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isBucket(element)) {
            const node = new vscode.TreeItem(element.bucketKey, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'bucket';
            return node;
        } else {
            const node = new vscode.TreeItem(element.objectKey, vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'object';
            return node;
        }
    }

    async getChildren(element?: SimpleStorageEntry | undefined): Promise<SimpleStorageEntry[]> {
        if (element && isBucket(element)) {
            const objects = await this._client.listObjects(element.bucketKey);
            return objects;
		} else {
            const buckets = await this._client.listBuckets();
            return buckets;
		}
    }
}