import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { withProgress, createWebViewPanel } from '../common';
import { IWebhook, IWebhookEvent } from '../models/webhooks';
import { webhooksServiceFor } from '../providers/webhooks';

export class WebhooksCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.wh.refreshWebhooks', this.refreshWebhooks.bind(this)),
            vscode.commands.registerCommand('aps.wh.createWebhook', this.createWebhook.bind(this)),
            vscode.commands.registerCommand('aps.wh.updateWebhook', this.updateWebhook.bind(this)),
            vscode.commands.registerCommand('aps.wh.deleteWebhook', this.deleteWebhook.bind(this)),
            vscode.commands.registerCommand('aps.wh.viewWebhookDetails', this.viewWebhookDetails.bind(this)),
        ];
    }

    async refreshWebhooks() {
        this.refresh();
    }

    async createWebhook(event: IWebhookEvent) {
        await createWebhook(event, this.context, this.refresh);
    }

    async updateWebhook(webhook: IWebhook) {
        await updateWebhook(webhook, this.context, this.refresh);
    }

    async deleteWebhook(webhook: IWebhook) {
        await deleteWebhook(webhook, this.context);
        this.refresh();
    }

    async viewWebhookDetails(webhook: IWebhook) {
        await viewWebhookDetails(webhook, this.context);
    }
}

async function createWebhook({ system, event, authContext }: IWebhookEvent, context: IContext, successCallback?: () => void) {
	const service = webhooksServiceFor(context, authContext);
	const scopes = service.getEventScopes(system, event);
	let panel = createWebViewPanel(context, 'create-webhook.js', 'create-webhook', 'Create Webhook', { system, event, scopes }, async message => {
		switch (message.command) {
			case 'create':
				try {
					await withProgress(`Creating webhook`, service.createWebhook(system, event, {
						callbackUrl: message.webhook.callbackUrl,
						scopeKey: message.webhook.scopeKey,
						scopeValue: message.webhook.scopeValue,
						filter: message.webhook.filter || undefined,
						hookAttribute: message.webhook.attributes ? JSON.parse(message.webhook.attributes) : undefined
					}));
					panel.dispose();
					vscode.window.showInformationMessage(`Webhook created`);
					if (successCallback) {
						successCallback();
					}
				} catch (err) {
					showErrorMessage(`Could not create webhook`, err, context);
				}
				break;
		}
	});
}

async function viewWebhookDetails({ id, system, event, authContext }: IWebhook, context: IContext) {
	try {
		const webhookDetail = await withProgress(`Getting webhook details: ${id}`, webhooksServiceFor(context, authContext).getHookDetails(system, event, id));
		createWebViewPanel(context, 'webhook-details.js', 'webhook-details', `Webhook Details: ${id}`, { detail: webhookDetail });
	} catch(err) {
		showErrorMessage('Could not access webhook', err, context);
	}
}

async function deleteWebhook({ system, event, id, authContext }: IWebhook, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete webhook ${id}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing webhook: ${id}`, webhooksServiceFor(context, authContext).deleteWebhook(system, event, id));
		vscode.window.showInformationMessage(`Webhook removed: ${id}`);
	} catch(err) {
		showErrorMessage('Could not remove webhook', err, context);
	}
}

async function updateWebhook({ system, event, id, authContext }: IWebhook, context: IContext, successCallback?: () => void) {
	try {
		const service = webhooksServiceFor(context, authContext);
		const webhookDetail = await withProgress(`Retrieving webhook data: ${id}`, service.getHookDetails(system, event, id));
		const scopes = service.getEventScopes(system, event);
		let panel = createWebViewPanel(context, 'update-webhook.js', 'update-webhook', `Update Webhook: ${id}`, { detail: webhookDetail, scopes }, async message => {
			switch (message.command) {
				case 'update':
					try {
						await withProgress(`Updating webhook ${id}`, service.updateWebhook(system, event, id, {
							filter: message.webhook.filter || undefined,
							hookAttribute: message.webhook.attributes ? JSON.parse(message.webhook.attributes) : undefined
						}));
						panel.dispose();
						if (successCallback) {
							successCallback();
						}
						vscode.window.showInformationMessage(`Webhook updated: ${id}`);
					} catch (err) {
						showErrorMessage(`Could not update webhook`, err, context);
					}
					break;
			}
		});
	} catch (err) {
		showErrorMessage('Could not retrieve webhook', err, context);
	}
}
