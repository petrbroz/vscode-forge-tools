import * as vscode from 'vscode';
import { BucketsItems, ObjectDetails } from '../models/oss';
import { Manifest, IDerivative } from '../models/model-derivative';
import { urnify } from '../urn';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';

export interface IHint {
    hint: string;
    tooltip?: string;
}

type SimpleStorageEntry = BucketsItems | ObjectDetails | IDerivative | IHint;

function isBucket(entry: SimpleStorageEntry): entry is BucketsItems {
    return (<BucketsItems>entry).policyKey !== undefined;
}

function isObject(entry: SimpleStorageEntry): entry is ObjectDetails {
    return (<ObjectDetails>entry).objectId !== undefined;
}

function isDerivative(entry: SimpleStorageEntry): entry is IDerivative {
    return (<IDerivative>entry).guid !== undefined;
}

function isHint(entry: SimpleStorageEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

export class SimpleStorageDataProvider implements vscode.TreeDataProvider<SimpleStorageEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<SimpleStorageEntry | null> = new vscode.EventEmitter<SimpleStorageEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<SimpleStorageEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: SimpleStorageEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(element: SimpleStorageEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isBucket(element)) {
            const node = new vscode.TreeItem(element.bucketKey, vscode.TreeItemCollapsibleState.Collapsed);
            node.tooltip = [
                `Bucket`,
                `Key: ${element.bucketKey}`,
                `Policy: ${element.policyKey}`
            ].join('\n');
            node.contextValue = 'bucket';
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
                    const objects = await this._context.ossService.getAllObjects(element.bucketKey);
                    return objects.sort(stringPropertySorter('objectKey'));
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
                const buckets = await this._context.ossService.getAllBuckets();
                return buckets.sort(stringPropertySorter('bucketKey'));
            }
        } catch(err) {
            showErrorMessage(`Could not load objects or buckets`, err);
        }
        return [];
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
