import * as vscode from 'vscode';
import {
    DataManagementClient,
    IBucket,
    IObject,
    DesignAutomationClient
} from 'forge-nodejs-utils';

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
        try {
            if (element && isBucket(element)) {
                const objects = await this._client.listObjects(element.bucketKey);
                return objects;
            } else {
                const buckets = await this._client.listBuckets();
                return buckets;
            }
        } catch(err) {
            vscode.window.showErrorMessage('Could not load objects or buckets: ' + JSON.stringify(err));
        }
        return [];
    }
}

enum DesignAutomationGroupType {
    OwnAppBundles = 'own-appbundles',
    SharedAppBundles = 'shared-appbundles',
    OwnActivities = 'own-activities',
    SharedActivities = 'shared-activities'
}

interface IGroupEntry {
    type: 'group';
    group: DesignAutomationGroupType;
    label: string;
}

export interface IAppBundleEntry {
    type: 'appbundle';
    id: string;
    label: string;
}

export interface IActivityEntry {
    type: 'activity';
    id: string;
    label: string;
}

type DesignAutomationEntry = IGroupEntry | IAppBundleEntry | IActivityEntry;

const DesignAutomationGroups: IGroupEntry[] = [
    { type: 'group', group: DesignAutomationGroupType.OwnAppBundles, label: 'My AppBundles' },
    { type: 'group', group: DesignAutomationGroupType.SharedAppBundles, label: 'Shared AppBundles' },
    { type: 'group', group: DesignAutomationGroupType.OwnActivities, label: 'My Activities' },
    { type: 'group', group: DesignAutomationGroupType.SharedActivities, label: 'Shared Activities' }
];

export class DesignAutomationDataProvider implements vscode.TreeDataProvider<DesignAutomationEntry> {
    private _client: DesignAutomationClient;
    private _clientId: string;
    private _onDidChangeTreeData: vscode.EventEmitter<DesignAutomationEntry | null> = new vscode.EventEmitter<DesignAutomationEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<DesignAutomationEntry | null> = this._onDidChangeTreeData.event;

    constructor(client: DesignAutomationClient, clientId: string) {
        this._client = client;
        this._clientId = clientId;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DesignAutomationEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let node: vscode.TreeItem;
        switch (element.type) {
            case 'group':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'appbundle':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            case 'activity':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            default:
                throw new Error('Unexpected entry type'); // Should never be hit
        }
        node.contextValue = element.type;
        return node;
    }

    async getChildren(element?: DesignAutomationEntry | undefined): Promise<DesignAutomationEntry[]> {
        if (!element) {
            return DesignAutomationGroups;
        } else {
            switch (element.type) {
                case 'group':
                    return this._getGroupChildren(element);
                case 'appbundle':
                    return this._getAppBundleChildren(element);
                case 'activity':
                    return this._getActivityChildren(element);
                default:
                    throw new Error('Unexpected entry type'); // Should never be hit
            }
        }
    }

    private async _getGroupChildren(group: IGroupEntry): Promise<DesignAutomationEntry[]> {
        try {
            switch (group.group) {
                case DesignAutomationGroupType.OwnAppBundles: {
                    const appBundleIDs = await this._client.listAppBundles();
                    return appBundleIDs.filter(id => !id.endsWith('$LATEST') && id.startsWith(this._clientId)).map(id => {
                        const parsedId = this._parseId(id);
                        return { type: 'appbundle', id: id, label: parsedId ? `${parsedId.name} (${parsedId.alias})` : id };
                    });
                }
                case DesignAutomationGroupType.SharedAppBundles: {
                    const appBundleIDs = await this._client.listAppBundles();
                    return appBundleIDs.filter(id => !id.endsWith('$LATEST') && !id.startsWith(this._clientId)).map(id => {
                        const parsedId = this._parseId(id);
                        return { type: 'appbundle', id: id, label: parsedId ? `${parsedId.name} (${parsedId.alias})` : id };
                    });
                }
                case DesignAutomationGroupType.OwnActivities: {
                    const activityIDs = await this._client.listActivities();
                    return activityIDs.filter(id => !id.endsWith('$LATEST') && id.startsWith(this._clientId)).map(id => {
                        const parsedId = this._parseId(id);
                        return { type: 'activity', id: id, label: parsedId ? `${parsedId.name} (${parsedId.alias})` : id };
                    });
                }
                case DesignAutomationGroupType.SharedActivities: {
                    const activityIDs = await this._client.listActivities();
                    return activityIDs.filter(id => !id.endsWith('$LATEST') && !id.startsWith(this._clientId)).map(id => {
                        const parsedId = this._parseId(id);
                        return { type: 'activity', id: id, label: parsedId ? `${parsedId.name} (${parsedId.alias})` : id };
                    });
                }
            }
        } catch(err) {
            vscode.window.showErrorMessage('Could not load appbundles or activities: ' + JSON.stringify(err));
        }
        return [];
    }

    private async _getAppBundleChildren(appBundle: IAppBundleEntry): Promise<DesignAutomationEntry[]> {
        return [];
    }

    private async _getActivityChildren(activity: IActivityEntry): Promise<DesignAutomationEntry[]> {
        return [];
    }

    private _parseId(id: string): { owner: string; name: string; alias: string} | null {
        const match = id.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\+([\$a-zA-Z0-9_]+)$/);
        return match ? { owner: match[1], name: match[2], alias: match[3] } : null;
    }
}