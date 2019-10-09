import * as vscode from 'vscode';
import { WebhookSystem, WebhookEvent } from 'forge-server-utils';
import { IContext } from '../common';

interface IWebhookSystem {
    type: 'system';
    name: string;
    system: WebhookSystem;
}

interface IWebhookEvent {
    type: 'event';
    name: string;
    system: WebhookSystem;
    event: WebhookEvent;
}

interface IWebhook {
    type: 'hook';
    system: WebhookSystem;
    event: WebhookEvent;
    id: string;
}

type WebhookEntry = IWebhookSystem | IWebhookEvent | IWebhook;

function isWebhookSystem(entry: WebhookEntry): entry is IWebhookSystem {
    return (<IWebhookSystem>entry).type === 'system';
}

function isWebhookEvent(entry: WebhookEntry): entry is IWebhookEvent {
    return (<IWebhookEvent>entry).type === 'event';
}

function isWebhook(entry: WebhookEntry): entry is IWebhook {
    return (<IWebhook>entry).type === 'hook';
}

export class WebhooksDataProvider implements vscode.TreeDataProvider<WebhookEntry> {
    private _context: IContext;
    private _onDidChangeTreeData: vscode.EventEmitter<WebhookEntry | null> = new vscode.EventEmitter<WebhookEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<WebhookEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext) {
        this._context = context;
    }

    refresh(entry?: WebhookEntry | null) {
        this._onDidChangeTreeData.fire(entry);
    }

    getTreeItem(entry: WebhookEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isWebhookSystem(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'system';
            return node;
        } else if (isWebhookEvent(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'event';
            return node;
        } else {
            const node = new vscode.TreeItem(entry.id, vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'hook';
            return node;
        }
    }

    async getChildren(entry?: WebhookEntry | undefined): Promise<WebhookEntry[]> {
        if (!entry) {
            return this._getWebhookSystems();
        } else if (isWebhookSystem(entry)) {
            return this._getWebhookEvents(entry);
        } else if (isWebhookEvent(entry)) {
            try {
                const webhooks = await this._context.webhookClient.listHooks(entry.system, entry.event);
                return webhooks.map(webhook => {
                    let result: IWebhook = {
                        type: 'hook',
                        system: entry.system,
                        event: entry.event,
                        id: webhook.hookId
                    };
                    return result;
                });
            } catch(err) {
                vscode.window.showErrorMessage('Could not list webhooks: ' + JSON.stringify(err));
            }
        }

        return [];
    }

    private _getWebhookSystems(): IWebhookSystem[] {
        return [
            { type: 'system', name: 'Data Management', system: WebhookSystem.Data },
            { type: 'system', name: 'Model Derivative', system: WebhookSystem.Derivative },
            { type: 'system', name: 'Fusion Lifecycle', system: WebhookSystem.FusionLifecycle },
            { type: 'system', name: 'Revit Cloud Worksharing', system: WebhookSystem.RevitCloudWorksharing }
        ];
    }

    private _getWebhookEvents(entry: IWebhookSystem): IWebhookEvent[] {
        switch (entry.system) {
            case WebhookSystem.Data:
                return Object.keys(WebhookEvent).filter(key => key.startsWith('Data')).map(key => ({
                    type: 'event',
                    name: key.replace('Data', '').replace(/([a-z])([A-Z])/g, '$1 $2'),
                    system: WebhookSystem.Data,
                    event: (WebhookEvent as any)[key]
                }));
            case WebhookSystem.Derivative:
                return Object.keys(WebhookEvent).filter(key => key.startsWith('Derivative')).map(key => ({
                    type: 'event',
                    name: key.replace('Derivative', '').replace(/([a-z])([A-Z])/g, '$1 $2'),
                    system: WebhookSystem.Derivative,
                    event: (WebhookEvent as any)[key]
                }));
            case WebhookSystem.FusionLifecycle:
                return Object.keys(WebhookEvent).filter(key => key.startsWith('Fusion')).map(key => ({
                    type: 'event',
                    name: key.replace('Fusion', '').replace(/([a-z])([A-Z])/g, '$1 $2'),
                    system: WebhookSystem.FusionLifecycle,
                    event: (WebhookEvent as any)[key]
                }));
            case WebhookSystem.RevitCloudWorksharing:
                return Object.keys(WebhookEvent).filter(key => key.startsWith('Revit')).map(key => ({
                    type: 'event',
                    name: key.replace('Revit', '').replace(/([a-z])([A-Z])/g, '$1 $2'),
                    system: WebhookSystem.RevitCloudWorksharing,
                    event: (WebhookEvent as any)[key]
                }));
            default:
                throw new Error(`Unsupported webhook system: ${entry.system}`);
        }
    }
}
