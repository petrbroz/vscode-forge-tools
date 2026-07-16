import * as vscode from 'vscode';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';
import { WebhookSystem, IWebhookSystem, IWebhookEvent, IWebhook, WebhookAuthContext } from '../models/webhooks';
import { WEBHOOKS } from '../services/webhooks-catalog';
import { WebhooksService } from '../services/webhooks';

/** The Webhooks service instance backing a given auth context (app-owned vs user-owned hooks). */
export function webhooksServiceFor(context: IContext, authContext: WebhookAuthContext): WebhooksService {
    return authContext === 'user' ? context.webhooksServiceUser : context.webhooksServiceApp;
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
    private _authContext: WebhookAuthContext;
    private _onDidChangeTreeData: vscode.EventEmitter<WebhookEntry | null> = new vscode.EventEmitter<WebhookEntry | null>();

	readonly onDidChangeTreeData?: vscode.Event<WebhookEntry | null> = this._onDidChangeTreeData.event;

    constructor(context: IContext, authContext: WebhookAuthContext) {
        this._context = context;
        this._authContext = authContext;
    }

    refresh(entry?: WebhookEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: WebhookEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isWebhookSystem(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = entry.system;
            node.tooltip = [
                `Webhook System`,
                `ID: ${entry.system}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.iconPath = new vscode.ThemeIcon('group-by-ref-type');
            node.contextValue = 'system';
            return node;
        } else if (isWebhookEvent(entry)) {
            const node = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
            node.id = `${entry.system}-${entry.event}`;
            node.tooltip = [
                `Webhook Event`,
                `Event: ${entry.event}`,
                `Name: ${entry.name}`
            ].join('\n');
            node.contextValue = 'event';
            node.iconPath = new vscode.ThemeIcon('symbol-event');
            return node;
        } else {
            const node = new vscode.TreeItem(entry.id, vscode.TreeItemCollapsibleState.None);
            node.id = entry.id;
            node.tooltip = [
                `Webhook`,
                `ID: ${entry.id}`,
                `System: ${entry.system}`,
                `Event: ${entry.event}`
            ].join('\n');
            node.contextValue = 'hook';
            node.iconPath = new vscode.ThemeIcon('megaphone');
            return node;
        }
    }

    async getChildren(entry?: WebhookEntry | undefined): Promise<WebhookEntry[]> {
        const authContext = this._authContext;
        if (!entry) {
            // User-owned webhooks need a user session -> return nothing so the "Sign in to APS" welcome view is shown instead.
            if (authContext === 'user' && !this._context.session) {
                return [];
            }
            return WEBHOOKS.map(webhook => ({ type: 'system', name: webhook.name, system: webhook.id, authContext }));
        } else if (isWebhookSystem(entry)) {
            const system = WEBHOOKS.find(webhook => webhook.id === entry.system) as WebhookSystem;
            return system.events.map(event => ({ type: 'event', name: event.id, system: system.id, event: event.id, authContext }));
        } else if (isWebhookEvent(entry)) {
            try {
                const { system, event } = entry;
                const webhooks = await webhooksServiceFor(this._context, authContext).getAllSystemEventHooks(system, event);
                return webhooks.map(webhook => {
                    return { type: 'hook', id: webhook.hookId!, system, event, authContext } as IWebhook;
                }).sort(stringPropertySorter('id'));
            } catch(err) {
                showErrorMessage(`Could not list webhooks`, err);
            }
        }
        return [];
    }
}
