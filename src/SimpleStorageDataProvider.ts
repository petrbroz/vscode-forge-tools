import * as vscode from 'vscode';
import { DataManagementClient, Bucket, Object } from 'forge-nodejs-utils';

type SimpleStorageEntry = Bucket | Object;

function isBucket(entry: SimpleStorageEntry): entry is Bucket {
    return (<Bucket>entry).policyKey !== undefined;
}

function isObject(entry: SimpleStorageEntry): entry is Object {
    return (<Object>entry).objectId !== undefined;
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
            return new vscode.TreeItem(element.bucketKey, vscode.TreeItemCollapsibleState.Collapsed);
        } else {
            return new vscode.TreeItem(element.objectKey, vscode.TreeItemCollapsibleState.None);
        }
    }

    async getChildren(element?: SimpleStorageEntry | undefined): Promise<SimpleStorageEntry[]> {
        if (element && isBucket(element)) {
            const objects = await this._client.listObjects(element.bucketKey);
            console.log('objects', objects);
            return objects;
		} else {
            const buckets = await this._client.listBuckets();
            console.log('buckets', buckets);
            return buckets;
		}
    }
}