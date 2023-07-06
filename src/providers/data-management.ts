import * as vscode from 'vscode';
import {
	IBucket,
    IObject,
    IDerivativeManifest,
    urnify
} from 'forge-server-utils';
import { IDerivative } from '../interfaces/model-derivative';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';
import { ModelDerivativeFormats, isViewableFormat } from './model-derivative';

export interface IHint {
    hint: string;
    tooltip?: string;
}

type SimpleStorageEntry = IBucket | IObject | IDerivative | IHint;

function isBucket(entry: SimpleStorageEntry): entry is IBucket {
    return (<IBucket>entry).policyKey !== undefined;
}

function isObject(entry: SimpleStorageEntry): entry is IObject {
    return (<IObject>entry).objectId !== undefined;
}

function isDerivative(entry: SimpleStorageEntry): entry is IDerivative {
    return (<IDerivative>entry).guid !== undefined;
}

function isHint(entry: SimpleStorageEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

export class SimpleStorageDataProvider implements vscode.TreeDataProvider<SimpleStorageEntry> {
    private _context: IContext;
    private _modelDerivativeFormats: ModelDerivativeFormats | null = null;
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
            node.contextValue = 'bucket';
            node.iconPath = new vscode.ThemeIcon('folder');
            return node;
        } else if (isObject(element)) {
            const node = new vscode.TreeItem(element.objectKey, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'object';
            node.iconPath = new vscode.ThemeIcon('file');
            return node;
        } else if (isDerivative(element)) {
            const node = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
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
                    const objects = await this._context.dataManagementClient.listObjects(element.bucketKey);
                    return objects.sort(stringPropertySorter('objectKey'));
                } else if (isObject(element)) {
                    const urn = urnify(element.objectId);
                    try {
                        const manifest = await this._context.modelDerivativeClient2L.getManifest(urn);
                        switch (manifest.status) {
                            case 'success':
                                const derivatives = await this._getManifestDerivatives(manifest, urn);
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
                const buckets = await this._context.dataManagementClient.listBuckets();
                return buckets.sort(stringPropertySorter('bucketKey'));
            }
        } catch(err) {
            showErrorMessage(`Could not load objects or buckets`, err);
        }
        return [];
    }

    private async _getManifestDerivatives(manifest: any, urn: string): Promise<IDerivative[]> {
        const formats = await this._findDerivativeFormats();

        const derivative = manifest.derivatives.find((deriv: any) => formats.hasOutput(deriv.outputType));

        if (isViewableFormat(derivative.outputType)) {
            return derivative.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
                return {
                    urn: urn,
                    name: geometry.name,
                    role: geometry.role,
                    guid: geometry.guid,
                    format: derivative.outputType,
                    bubble: geometry
                };
            });
        } else {
            return derivative.children.filter((child: any) => child.role === derivative.outputType).map((resource: any) => {
                const fileUrn: string = resource.urn;
                const filePathParts = fileUrn.split("/");

                return {
                    urn,
                    name: filePathParts[filePathParts.length - 1],
                    role: resource.role,
                    guid: resource.guid,
                    format: derivative.outputType,
                    bubble: {
                        fileUrn
                    },
                    nonViewable: true
                }
            });
        }
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

    private _getManifestProgressHint(manifest: IDerivativeManifest, urn: string): IHint {
        return { hint: `Translation in progress (${manifest.progress})` };
    }

    private async _findDerivativeFormats(): Promise<ModelDerivativeFormats> {
        if (!this._modelDerivativeFormats)
            this._modelDerivativeFormats = await ModelDerivativeFormats.create(this._context);

        return this._modelDerivativeFormats;
    }
}
