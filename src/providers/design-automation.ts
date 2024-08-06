import * as vscode from 'vscode';
import { DesignAutomationID } from 'aps-sdk-node';
import { IContext } from '../common';
import * as dai from '../interfaces/design-automation';

type DesignAutomationEntry =
    | dai.IOwnedAppBundlesEntry | dai.ISharedAppBundlesEntry
    | dai.ISharedAppBundleEntry | dai.IAppBundleEntry
    | dai.IAppBundleAliasesEntry | dai.IAppBundleAliasEntry
    | dai.IAppBundleVersionsEntry | dai.IAppBundleVersionEntry
    | dai.IOwnedActivitiesEntry | dai.ISharedActivitiesEntry
    | dai.ISharedActivityEntry | dai.IActivityEntry
    | dai.IActivityAliasesEntry | dai.IActivityAliasEntry
    | dai.IActivityVersionsEntry | dai.IActivityVersionEntry;

const ThemeIconMap = {
    'activity-alias': 'references',
    'activity-aliases': 'references',
    'activity-version': 'versions',
    'activity-versions': 'versions',
    'appbundle-alias': 'references',
    'appbundle-aliases': 'references',
    'appbundle-version': 'versions',
    'appbundle-versions': 'versions',
    'owned-activities': 'github-action',
    'owned-activity': 'github-action',
    'owned-appbundle': 'plug',
    'owned-appbundles': 'plug',
    'shared-activities': 'github-action',
    'shared-activity': 'github-action',
    'shared-appbundle': 'plug',
    'shared-appbundles': 'plug',
};

export class DesignAutomationDataProvider implements vscode.TreeDataProvider<DesignAutomationEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<DesignAutomationEntry | null> = new vscode.EventEmitter<DesignAutomationEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<DesignAutomationEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: DesignAutomationEntry) {
        this._onDidChangeTreeData.fire(entry || null);
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
            case 'appbundle-version':
            case 'shared-appbundle':
            case 'activity-version':
            case 'shared-activity':
                node = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                break;
            case 'appbundle-alias':
            case 'activity-alias':
                node = new vscode.TreeItem(`${element.label} [v${element.version}]`, vscode.TreeItemCollapsibleState.None);
                break;
            default:
                throw new Error('Unexpected entry type'); // Should never be hit
        }
        node.iconPath = new vscode.ThemeIcon(ThemeIconMap[element.type]);
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

    private async _getOwnedAppBundles(entry: dai.IOwnedAppBundlesEntry): Promise<dai.IAppBundleEntry[]> {
        const nickname = await this._context.designAutomationClient.getNickname();
        const appBundleIDs = await this._context.designAutomationClient.listAppBundles();
        const filteredIDs = appBundleIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner === nickname) as DesignAutomationID[];
        const uniqueIDs = new Set(filteredIDs.map(item => item.id));
        return Array.from(uniqueIDs.values()).map(appbundle => ({ type: 'owned-appbundle', client: nickname, appbundle: appbundle, label: appbundle }));
    }

    private async _getSharedAppBundles(entry: dai.ISharedAppBundlesEntry): Promise<dai.ISharedAppBundleEntry[]> {
        const nickname = await this._context.designAutomationClient.getNickname();
        const appBundleIDs = await this._context.designAutomationClient.listAppBundles();
        const filteredIDs = appBundleIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner !== nickname) as DesignAutomationID[];
        return filteredIDs.map(id => ({ type: 'shared-appbundle', fullid: id.toString(), label: id.toString() }));
    }

    private async _getAppBundleChildren(entry: dai.IAppBundleEntry): Promise<(dai.IAppBundleAliasesEntry | dai.IAppBundleVersionsEntry)[]> {
        return [
            { type: 'appbundle-aliases', client: entry.client, appbundle: entry.appbundle, label: 'Aliases' },
            { type: 'appbundle-versions', client: entry.client, appbundle: entry.appbundle, label: 'Versions' }
        ];
    }

    private async _getAppBundleAliases(entry: dai.IAppBundleAliasesEntry): Promise<dai.IAppBundleAliasEntry[]> {
        const aliases = await this._context.designAutomationClient.listAppBundleAliases(entry.appbundle);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'appbundle-alias', client: entry.client, appbundle: entry.appbundle, alias: alias.id, label: alias.id, version: alias.version }));
    }

    private async _getAppBundleVersions(entry: dai.IAppBundleVersionsEntry): Promise<dai.IAppBundleVersionEntry[]> {
        const versions = await this._context.designAutomationClient.listAppBundleVersions(entry.appbundle);
        return versions.map(version => ({ type: 'appbundle-version', client: entry.client, appbundle: entry.appbundle, version: version, label: version.toString() }));
    }

    private async _getOwnedActivities(entry: dai.IOwnedActivitiesEntry): Promise<dai.IActivityEntry[]> {
        const nickname = await this._context.designAutomationClient.getNickname();
        const activityIDs = await this._context.designAutomationClient.listActivities();
        const filteredIDs = activityIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner === nickname) as DesignAutomationID[];
        const uniqueIDs = new Set<string>(filteredIDs.map(id => id.id));
        return Array.from(uniqueIDs.values()).map(activity => ({ type: 'owned-activity', client: nickname, activity: activity, label: activity }));
    }

    private async _getSharedActivities(entry: dai.ISharedActivitiesEntry): Promise<dai.ISharedActivityEntry[]> {
        const nickname = await this._context.designAutomationClient.getNickname();
        const activityIDs = await this._context.designAutomationClient.listActivities();
        const filteredIDs = activityIDs.map(DesignAutomationID.parse).filter(item => item !== null && item.owner !== nickname) as DesignAutomationID[];
        return filteredIDs.map(id => ({ type: 'shared-activity', fullid: id.toString(), label: id.toString() }));
    }

    private async _getActivityChildren(entry: dai.IActivityEntry): Promise<(dai.IActivityAliasesEntry | dai.IActivityVersionsEntry)[]> {
        return [
            { type: 'activity-aliases', client: entry.client, activity: entry.activity, label: 'Aliases' },
            { type: 'activity-versions', client: entry.client, activity: entry.activity, label: 'Versions' }
        ];
    }

    private async _getActivityAliases(entry: dai.IActivityAliasesEntry): Promise<DesignAutomationEntry[]> {
        const aliases = await this._context.designAutomationClient.listActivityAliases(entry.activity);
        return aliases
            .filter(alias => alias.id !== '$LATEST')
            .map(alias => ({ type: 'activity-alias', client: entry.client, activity: entry.activity, alias: alias.id, label: alias.id, version: alias.version }));
    }

    private async _getActivityVersions(entry: dai.IActivityVersionsEntry): Promise<DesignAutomationEntry[]> {
        const versions = await this._context.designAutomationClient.listActivityVersions(entry.activity);
        return versions.map(version => ({ type: 'activity-version', client: entry.client, activity: entry.activity, version: version, label: version.toString() }));
    }
}
