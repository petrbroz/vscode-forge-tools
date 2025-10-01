import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook, IWebhookEvent } from '../providers/webhooks';
import { withProgress, createWebViewPanel } from '../common';
import { WebhookEvent, WEBHOOKS, WebhookSystem } from '../interfaces/webhooks';

export async function createWebhook({ system, event }: IWebhookEvent, context: IContext, successCallback?: () => void) {
	const _system = WEBHOOKS.find(webhook => webhook.id === system) as WebhookSystem;
	const _event = _system.events.find(ev => ev.id === event) as WebhookEvent;
	const { scopes } = _event;
	let panel = createWebViewPanel(context, 'create-webhook.js', 'create-webhook', 'Create Webhook', { system, event, scopes }, async message => {
		switch (message.command) {
			case 'create':
				try {
					// @ts-ignore
					const id = await withProgress(`Creating webhook`, context.webhookClient.createHook(system, event, {
						callbackUrl: message.webhook.callbackUrl,
						// @ts-ignore
						scope: { [message.webhook.scopeKey]: message.webhook.scopeValue },
						filter: message.webhook.filter || null,
						hookAttribute: message.webhook.attributes ? JSON.parse(message.webhook.attributes) : null
					}));
					panel.dispose();
					vscode.window.showInformationMessage(`Webhook created: ${id as string}`);
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

export async function viewWebhookDetails({ id, system, event }: IWebhook, context: IContext) {
	try {
		// @ts-ignore
		const webhookDetail = await withProgress(`Getting webhook details: ${id}`, context.webhookClient.getHookDetails(system, event, id));
		createWebViewPanel(context, 'webhook-details.js', 'webhook-details', `Webhook Details: ${id}`, { detail: webhookDetail });
	} catch(err) {
		showErrorMessage('Could not access webhook', err, context);
	}
}

export async function deleteWebhook({ system, event, id }: IWebhook, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete webhook ${id}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		// @ts-ignore
		await withProgress(`Removing webhook: ${id}`, context.webhookClient.deleteHook(system, event, id));
		vscode.window.showInformationMessage(`Webhook removed: ${id}`);
	} catch(err) {
		showErrorMessage('Could not remove webhook', err, context);
	}
}

export async function updateWebhook({ system, event, id }: IWebhook, context: IContext, successCallback?: () => void) {
	try {
		// @ts-ignore
		const webhookDetail = await withProgress(`Retrieving webhook data: ${id}`, context.webhookClient.getHookDetails(system, event, id));
		const _system = WEBHOOKS.find(webhook => webhook.id === system) as WebhookSystem;
		const _event = _system.events.find(ev => ev.id === event) as WebhookEvent;
		const { scopes } = _event;
		let panel = createWebViewPanel(context, 'update-webhook.js', 'update-webhook', `Update Webhook: ${id}`, { detail: webhookDetail, scopes }, async message => {
			switch (message.command) {
				case 'update':
					try {
						// @ts-ignore
						await withProgress(`Updating webhook ${id}`, context.webhookClient.updateHook(system, event, id, {
							// status: message.webhook.status,
							filter: message.webhook.filter || null,
							hookAttribute: message.webhook.attributes ? JSON.parse(message.webhook.attributes) : null
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
