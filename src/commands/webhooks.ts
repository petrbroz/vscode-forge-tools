import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook, IWebhookEvent } from '../providers/webhooks';
import { WebhookSystem } from 'forge-server-utils';
import { withProgress, createWebViewPanel } from '../common';

function webhookScopes(system: WebhookSystem): string[] {
	let scopes: string[] = [];
	switch (system) {
		case WebhookSystem.Data:
		case WebhookSystem.RevitCloudWorksharing:
			scopes.push('folder');
			break;
		case WebhookSystem.Derivative:
			scopes.push('workflow');
			break;
		case WebhookSystem.FusionLifecycle:
			scopes.push('workspace');
			scopes.push('workflow.transition');
			break;
	}
	return scopes;
}

export async function createWebhook({ system, event }: IWebhookEvent, context: IContext, successCallback?: () => void) {
	const scopes = webhookScopes(system);
	let panel = createWebViewPanel(context, 'create-webhook.js', 'create-webhook', 'Create Webhook', { system, event, scopes }, async message => {
		switch (message.command) {
			case 'create':
				try {
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
					showErrorMessage(`Could not create webhook`, err);
				}
				break;
		}
	});
}

export async function viewWebhookDetails({ id, system, event }: IWebhook, context: IContext) {
	try {
		const webhookDetail = await withProgress(`Getting webhook details: ${id}`, context.webhookClient.getHookDetails(system, event, id));
		createWebViewPanel(context, 'webhook-details.js', 'webhook-details', `Webhook Details: ${id}`, { detail: webhookDetail });
	} catch(err) {
		showErrorMessage('Could not access webhook', err);
	}
}

export async function deleteWebhook({ system, event, id }: IWebhook, context: IContext) {
	try {
		await withProgress(`Removing webhook: ${id}`, context.webhookClient.deleteHook(system, event, id));
		vscode.window.showInformationMessage(`Webhook removed: ${id}`);
	} catch(err) {
		showErrorMessage('Could not remove webhook', err);
	}
}

export async function updateWebhook({ system, event, id }: IWebhook, context: IContext, successCallback?: () => void) {
	try {
		const webhookDetail = await withProgress(`Retrieving webhook data: ${id}`, context.webhookClient.getHookDetails(system, event, id));
		const scopes = webhookScopes(system);
		let panel = createWebViewPanel(context, 'update-webhook.js', 'update-webhook', `Update Webhook: ${id}`, { detail: webhookDetail, scopes }, async message => {
			switch (message.command) {
				case 'update':
					try {
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
						showErrorMessage(`Could not update webhook`, err);
					}
					break;
			}
		});
	} catch (err) {
		showErrorMessage('Could not retrieve webhook', err);
	}
}
