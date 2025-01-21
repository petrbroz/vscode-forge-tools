import * as vscode from 'vscode';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';
import { WebhookSystem, WEBHOOKS } from '../interfaces/webhooks';

export interface IWebhookSystem {
    type: 'system';
    name: string;
    system: string;
}

export interface IWebhookEvent {
    type: 'event';
    name: string;
    system: string;
    event: string;
}

export interface IWebhook {
    type: 'hook';
    id: string;
    system: string;
    event: string;
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

    refresh(entry?: WebhookEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: WebhookEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isWebhookSystem(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.iconPath = new vscode.ThemeIcon('group-by-ref-type');
            node.contextValue = 'system';
            return node;
        } else if (isWebhookEvent(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.contextValue = 'event';
            node.iconPath = new vscode.ThemeIcon('symbol-event');
            return node;
        } else {
            const node = new vscode.TreeItem(entry.id, vscode.TreeItemCollapsibleState.None);
            node.contextValue = 'hook';
            node.iconPath = new vscode.ThemeIcon('megaphone');
            return node;
        }
    }

    async getChildren(entry?: WebhookEntry | undefined): Promise<WebhookEntry[]> {
        if (!entry) {
            return WEBHOOKS.map(webhook => ({ type: 'system', name: webhook.name, system: webhook.id }));
        } else if (isWebhookSystem(entry)) {
            const system = WEBHOOKS.find(webhook => webhook.id === entry.system) as WebhookSystem;
            return system.events.map(event => ({ type: 'event', name: event.id, system: system.id, event: event.id }));
        } else if (isWebhookEvent(entry)) {
            try {
                const { system, event } = entry;
                // @ts-ignore
                const webhooks = await this._context.webhookClient.listHooks(system, event);
                return webhooks.map(webhook => {
                    return { type: 'hook', id: webhook.hookId, system, event } as IWebhook;
                }).sort(stringPropertySorter('id'));
            } catch(err) {
                showErrorMessage(`Could not list webhooks`, err);
            }
        }
        return [];
    }
}
