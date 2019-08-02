import * as vscode from 'vscode';
import {
    DesignAutomationID
} from 'forge-server-utils';
import {
    IContext
} from '../common';

interface IDesignAutomationEntry {
    label: string;
}

export interface ISharedAppBundlesEntry extends IDesignAutomationEntry {
    type: 'shared-appbundles';
}

export interface ISharedAppBundleEntry extends IDesignAutomationEntry {
    type: 'shared-appbundle';
    fullid: string;
}

export interface IOwnedAppBundlesEntry extends IDesignAutomationEntry {
    type: 'owned-appbundles';
}

export interface IAppBundleEntry extends IDesignAutomationEntry {
    type: 'owned-appbundle';
    client: string;
    appbundle: string;
}

export interface IAppBundleAliasesEntry extends IDesignAutomationEntry {
    type: 'appbundle-aliases';
    client: string;
    appbundle: string;
}

export interface IAppBundleAliasEntry extends IDesignAutomationEntry {
    type: 'appbundle-alias';
    client: string;
    appbundle: string;
    alias: string;
}

export interface IAppBundleVersionsEntry extends IDesignAutomationEntry {
    type: 'appbundle-versions';
    client: string;
    appbundle: string;
}

export interface IAppBundleVersionEntry extends IDesignAutomationEntry {
    type: 'appbundle-version';
    client: string;
    appbundle: string;
    version: number;
}

export interface ISharedActivitiesEntry extends IDesignAutomationEntry {
    type: 'shared-activities';
}

export interface ISharedActivityEntry extends IDesignAutomationEntry {
    type: 'shared-activity';
    fullid: string;
}

export interface IOwnedActivitiesEntry extends IDesignAutomationEntry {
    type: 'owned-activities';
}

export interface IActivityEntry extends IDesignAutomationEntry {
    type: 'owned-activity';
    client: string;
    activity: string;
}

export interface IActivityAliasesEntry extends IDesignAutomationEntry {
    type: 'activity-aliases';
    client: string;
    activity: string;
}

export interface IActivityAliasEntry extends IDesignAutomationEntry {
    type: 'activity-alias';
    client: string;
    activity: string;
    alias: string;
}

export interface IActivityVersionsEntry extends IDesignAutomationEntry {
    type: 'activity-versions';
    client: string;
    activity: string;
}

export interface IActivityVersionEntry extends IDesignAutomationEntry {
    type: 'activity-version';
    client: string;
    activity: string;
    version: number;
}

type DesignAutomationEntry =
    | IOwnedAppBundlesEntry | ISharedAppBundlesEntry | ISharedAppBundleEntry | IAppBundleEntry | IAppBundleAliasesEntry | IAppBundleAliasEntry | IAppBundleVersionsEntry | IAppBundleVersionEntry
    | IOwnedActivitiesEntry | ISharedActivitiesEntry | ISharedActivityEntry | IActivityEntry | IActivityAliasesEntry | IActivityAliasEntry | IActivityVersionsEntry | IActivityVersionEntry;

export class DesignAutomationDataProvider implements vscode.TreeDataProvider<DesignAutomationEntry> {
    private _context: IContext;
    private _clientId: string;
    private _onDidChangeTreeData: vscode.EventEmitter<DesignAutomationEntry | null> = new vscode.EventEmitter<DesignAutomationEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<DesignAutomationEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext, clientId: string) {
        this._context = context;
        this._clientId = clientId;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DesignAutomationEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let node: vscode.TreeItem;
        switch (element.type) {
            case 'owned-appbundles':
            case 'shared-appbundles':
            case 'owned-appbundle':
            case 'appbundle-aliases':
            case 'appbundle-versions':
            case 'owned-activities':
            case 'shared-activities':
            case 'owned-activity':
            case 'activity-aliases':
            case 'activity-versions':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                break;
            case 'appbundle-alias':
            case 'appbundle-version':
            case 'shared-appbundle':
            case 'activity-alias':
            case 'activity-version':
            case 'shared-activity':
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
            return [
                { type: 'owned-appbundles', label: 'Owned App Bundles' },
                { type: 'shared-appbundles', label: 'Shared App Bundles' },
                { type: 'owned-activities', label: 'Owned Activities' },
                { type: 'shared-activities', label: 'Shared Activities' }
            ];
        } else {
            switch (element.type) {
                case 'owned-appbundles':
                    return this._getOwnedAppBundles(element);
                case 'shared-appbundles':
                    return this._getSharedAppBundles(element);
                case 'owned-appbundle':
                    return this._getAppBundleChildren(element);
                case 'appbundle-aliases':
                    return this._getAppBundleAliases(element);
                case 'appbundle-versions':
                    return this._getAppBundleVersions(element);
                case 'owned-activities':
                    return this._getOwnedActivities(element);
                case 'shared-activities':
                    return this._getSharedActivities(element);
                case 'owned-activity':
                    return this._getActivityChildren(element);
                case 'activity-aliases':
                    return this._getActivityAliases(element);
                case 'activity-versions':
                    return this._getActivityVersions(element);
                default:
                    throw new Error('Unexpected entry type'); // Should never be hit
            }
        }
    }

    private async _getOwnedAppBundles(entry: IOwnedAppBundlesEntry): Promise<IAppBundleEntry[]> {
        const appBundleIDs = await this._context.designAutomationClient.listAppBundles();
        const filteredIDs = appBundleIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner === this._clientId) as DesignAutomationID[];
        const uniqueIDs = new Set(filteredIDs.map(item => item.id));
        return Array.from(uniqueIDs.values()).map(appbundle => ({ type: 'owned-appbundle', client: this._clientId, appbundle: appbundle, label: appbundle }));
    }

    private async _getSharedAppBundles(entry: ISharedAppBundlesEntry): Promise<ISharedAppBundleEntry[]> {
        const appBundleIDs = await this._context.designAutomationClient.listAppBundles();
        const filteredIDs = appBundleIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner !== this._clientId) as DesignAutomationID[];
        return filteredIDs.map(id => ({ type: 'shared-appbundle', fullid: id.toString(), label: id.toString() }));
    }

    private async _getAppBundleChildren(entry: IAppBundleEntry): Promise<(IAppBundleAliasesEntry | IAppBundleVersionsEntry)[]> {
        return [
            { type: 'appbundle-aliases', client: entry.client, appbundle: entry.appbundle, label: 'Aliases' },
            { type: 'appbundle-versions', client: entry.client, appbundle: entry.appbundle, label: 'Versions' }
        ];
    }

    private async _getAppBundleAliases(entry: IAppBundleAliasesEntry): Promise<IAppBundleAliasEntry[]> {
        const aliases = await this._context.designAutomationClient.listAppBundleAliases(entry.appbundle);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'appbundle-alias', client: entry.client, appbundle: entry.appbundle, alias: alias.id, label: alias.id }));
    }

    private async _getAppBundleVersions(entry: IAppBundleVersionsEntry): Promise<IAppBundleVersionEntry[]> {
        const versions = await this._context.designAutomationClient.listAppBundleVersions(entry.appbundle);
        return versions.map(version => ({ type: 'appbundle-version', client: entry.client, appbundle: entry.appbundle, version: version, label: version.toString() }));
    }

    private async _getOwnedActivities(entry: IOwnedActivitiesEntry): Promise<IActivityEntry[]> {
        const activityIDs = await this._context.designAutomationClient.listActivities();
        const filteredIDs = activityIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner === this._clientId) as DesignAutomationID[];
        const uniqueIDs = new Set<string>(filteredIDs.map(id => id.id));
        return Array.from(uniqueIDs.values()).map(activity => ({ type: 'owned-activity', client: this._clientId, activity: activity, label: activity }));
    }

    private async _getSharedActivities(entry: ISharedActivitiesEntry): Promise<ISharedActivityEntry[]> {
        const activityIDs = await this._context.designAutomationClient.listActivities();
        const filteredIDs = activityIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner !== this._clientId) as DesignAutomationID[];
        return filteredIDs.map(id => ({ type: 'shared-activity', fullid: id.toString(), label: id.toString() }));
    }

    private async _getActivityChildren(entry: IActivityEntry): Promise<(IActivityAliasesEntry | IActivityVersionsEntry)[]> {
        return [
            { type: 'activity-aliases', client: entry.client, activity: entry.activity, label: 'Aliases' },
            { type: 'activity-versions', client: entry.client, activity: entry.activity, label: 'Versions' }
        ];
    }

    private async _getActivityAliases(entry: IActivityAliasesEntry): Promise<DesignAutomationEntry[]> {
        const aliases = await this._context.designAutomationClient.listActivityAliases(entry.activity);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'activity-alias', client: entry.client, activity: entry.activity, alias: alias.id, label: alias.id }));
    }

    private async _getActivityVersions(entry: IActivityVersionsEntry): Promise<DesignAutomationEntry[]> {
        const versions = await this._context.designAutomationClient.listActivityVersions(entry.activity);
        return versions.map(version => ({ type: 'activity-version', client: entry.client, activity: entry.activity, version: version, label: version.toString() }));
    }
}
