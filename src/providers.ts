import * as vscode from 'vscode';
import {
	IBucket,
	IObject,
    DataManagementClient,
    DesignAutomationClient,
    DesignAutomationID
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

export interface IGroupEntry {
    type: 'group';
    group: DesignAutomationGroupType;
    label: string;
}

export interface IAppBundleEntry {
    type: 'appbundle';
    id: string;
    label: string;
}

export interface IAppBundleAliasGroupEntry {
    type: 'appbundle-aliases';
    appbundle: string;
    label: string;
}

export interface IAppBundleAliasEntry {
    type: 'appbundle-alias';
    appbundle: string;
    alias: string;
    label: string;
}

export interface IAppBundleVersionGroupEntry {
    type: 'appbundle-versions';
    appbundle: string;
    label: string;
}

export interface IAppBundleVersionEntry {
    type: 'appbundle-version';
    appbundle: string;
    version: number;
    label: string;
}

export interface IActivityEntry {
    type: 'activity';
    id: string;
    label: string;
}

export interface IActivityAliasGroupEntry {
    type: 'activity-aliases';
    activity: string;
    label: string;
}

export interface IActivityAliasEntry {
    type: 'activity-alias';
    activity: string;
    alias: string;
    label: string;
}

export interface IActivityVersionGroupEntry {
    type: 'activity-versions';
    activity: string;
    label: string;
}

export interface IActivityVersionEntry {
    type: 'activity-version';
    activity: string;
    version: number;
    label: string;
}

type DesignAutomationEntry = IGroupEntry
    | IAppBundleEntry | IAppBundleAliasGroupEntry | IAppBundleAliasEntry | IAppBundleVersionGroupEntry | IAppBundleVersionEntry
    | IActivityEntry | IActivityAliasGroupEntry | IActivityAliasEntry | IActivityVersionGroupEntry | IActivityVersionEntry;

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
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'appbundle-aliases':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'appbundle-alias':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            case 'appbundle-versions':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'appbundle-version':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            case 'activity':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'activity-aliases':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'activity-alias':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            case 'activity-versions':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'activity-version':
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
                case 'appbundle-aliases':
                    return this._getAppBundleAliasChildren(element);
                case 'appbundle-versions':
                    return this._getAppBundleVersionChildren(element);
                case 'activity':
                    return this._getActivityChildren(element);
                case 'activity-aliases':
                    return this._getActivityAliasChildren(element);
                case 'activity-versions':
                    return this._getActivityVersionChildren(element);
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
        return [
            { type: 'appbundle-aliases', appbundle: appBundle.id, label: 'Aliases' },
            { type: 'appbundle-versions', appbundle: appBundle.id, label: 'Versions' }
        ];
    }

    private async _getAppBundleAliasChildren(aliasGroup: IAppBundleAliasGroupEntry): Promise<DesignAutomationEntry[]> {
        const appBundleID = DesignAutomationID.parse(aliasGroup.appbundle);
        if (!appBundleID) {
            throw new Error('Cannot parse app bundle ID.');
        }
        const aliases = await this._client.listAppBundleAliases(appBundleID.id);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'appbundle-alias', appbundle: appBundleID.id, alias: alias.id, label: alias.id }));
    }

    private async _getAppBundleVersionChildren(versionGroup: IAppBundleVersionGroupEntry): Promise<DesignAutomationEntry[]> {
        const appBundleID = DesignAutomationID.parse(versionGroup.appbundle);
        if (!appBundleID) {
            throw new Error('Cannot parse app bundle ID.');
        }
        const versions = await this._client.listAppBundleVersions(appBundleID.id);
        return versions.map(version => ({ type: 'appbundle-version', appbundle: appBundleID.id, version: version, label: version.toString() }));
    }

    private async _getActivityChildren(activity: IActivityEntry): Promise<DesignAutomationEntry[]> {
        return [
            { type: 'activity-aliases', activity: activity.id, label: 'Aliases' },
            { type: 'activity-versions', activity: activity.id, label: 'Versions' }
        ];
    }

    private async _getActivityAliasChildren(aliasGroup: IActivityAliasGroupEntry): Promise<DesignAutomationEntry[]> {
        const activityID = DesignAutomationID.parse(aliasGroup.activity);
        if (!activityID) {
            throw new Error('Cannot parse activity ID.');
        }
        const aliases = await this._client.listActivityAliases(activityID.id);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'activity-alias', activity: activityID.id, alias: alias.id, label: alias.id }));
    }

    private async _getActivityVersionChildren(versionGroup: IActivityVersionGroupEntry): Promise<DesignAutomationEntry[]> {
        const activityID = DesignAutomationID.parse(versionGroup.activity);
        if (!activityID) {
            throw new Error('Cannot parse activity ID.');
        }
        const versions = await this._client.listActivityVersions(activityID.id);
        return versions.map(version => ({ type: 'activity-version', activity: activityID.id, version: version, label: version.toString() }));
    }

    private _parseId(id: string): { owner: string; name: string; alias: string} | null {
        const match = id.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\+([\$a-zA-Z0-9_]+)$/);
        return match ? { owner: match[1], name: match[2], alias: match[3] } : null;
    }
}