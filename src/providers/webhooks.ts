import * as vscode from 'vscode';
import { BaseTreeProvider } from './base';
import { IContext, stringPropertySorter, showErrorMessage } from '../common';
import { WebhookSystem, IWebhookSystem, IWebhookEvent, IWebhook, WebhookAuthContext } from '../models/webhooks';
import { WEBHOOKS } from '../services/webhooks-catalog';
import { WebhooksService } from '../services/webhooks';

/** The Webhooks service instance backing a given auth context (app-owned vs user-owned hooks). */
export function webhooksServiceFor(context: IContext, authContext: WebhookAuthContext): WebhooksService {
    return authContext === 'user' ? context.webhooksServiceUser : context.webhooksServiceApp;
}

/** URI scheme of the `resourceUri`s assigned to webhook tree items; the hook status is carried in the query. */
export const WEBHOOK_SCHEME = 'aps-webhook';

/** Shows a badge on webhooks that are not active, based on the status already returned when listing hooks. */
export class WebhookDecorationProvider implements vscode.FileDecorationProvider {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (uri.scheme !== WEBHOOK_SCHEME) {
            return undefined;
        }
        const status = new URLSearchParams(uri.query).get('status');
        if (status && status !== 'active') {
            return new vscode.FileDecoration('⊘', `Webhook is ${status}`, new vscode.ThemeColor('disabledForeground'));
        }
        return undefined;
    }

    refresh(): void {
        this._onDidChangeFileDecorations.fire(undefined);
    }
}

type WebhookEntry = IWebhookSystem | IWebhookEvent | IWebhook;

function isWebhookSystem(entry: WebhookEntry): entry is IWebhookSystem {
    return (<IWebhookSystem>entry).type === 'system';
}

function isWebhookEvent(entry: WebhookEntry): entry is IWebhookEvent {
    return (<IWebhookEvent>entry).type === 'event';
}

export class WebhooksDataProvider extends BaseTreeProvider<WebhookEntry> {
    private _context: IContext;
    private _authContext: WebhookAuthContext;

    constructor(context: IContext, authContext: WebhookAuthContext) {
        super();
        this._context = context;
        this._authContext = authContext;
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
            node.resourceUri = vscode.Uri.from({
                scheme: WEBHOOK_SCHEME,
                path: `/${entry.authContext}/${entry.id}`,
                query: new URLSearchParams({ status: entry.status ?? '' }).toString()
            });
            node.tooltip = [
                `Webhook`,
                `ID: ${entry.id}`,
                ...(entry.status ? [`Status: ${entry.status}`] : []),
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
                    return { type: 'hook', id: webhook.hookId!, system, event, authContext, status: webhook.status } as IWebhook;
                }).sort(stringPropertySorter('id'));
            } catch(err) {
                showErrorMessage(`Could not list webhooks`, err);
            }
        }
        return [];
    }
}
