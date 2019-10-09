import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook, IWebhookEvent } from '../providers/webhooks';
import { WebhookSystem, IWebhook as IWebhookDetails, IUpdateWebhookParams } from 'forge-server-utils';

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

export async function createWebhook(entry: IWebhookEvent, context: IContext, successCallback?: () => void) {
	const scopes = webhookScopes(entry.system);
	const panel = vscode.window.createWebviewPanel(
		'create-webhook',
		`New webhook`,
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);
	let webhook = {
		system: entry.system,
		event: entry.event,
		status: 'active',
		scope: {}
	};
	panel.webview.html = context.templateEngine.render('webhook-details', { webhook, mode: 'create', scopes });
	// Handle messages from the webview
	panel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case 'create':
					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: `Creating webhook`,
						cancellable: false
					}, async (progress, token) => {
						try {
							const id = await context.webhookClient.createHook(entry.system, entry.event, {
								callbackUrl: message.webhook.callbackUrl,
								scope: message.webhook.scope
							});
							panel.dispose();
							vscode.window.showInformationMessage(`Webhook created: ${id as string}`);
							if (successCallback) {
								successCallback();
							}
						} catch (err) {
							vscode.window.showErrorMessage(`Could not create webhook: ${err})`);
						}
					});
					break;
				case 'cancel':
					panel.dispose();
					break;
			}
		},
		undefined,
		context.extensionContext.subscriptions
	);
}

export async function viewWebhookDetails(webhook: IWebhook, context: IContext) {
	try {
        const { system, event, id } = webhook;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting webhook details: ${webhook.id}`,
			cancellable: false
		}, async (progress, token) => {
			const webhookDetail = await context.webhookClient.getHookDetails(system, event, id);
			const scopes = webhookScopes(webhook.system);
			const panel = vscode.window.createWebviewPanel(
				'webhook-details',
				`Webhook: ${id}`,
				vscode.ViewColumn.One,
				{ enableScripts: false }
			);
			panel.webview.html = context.templateEngine.render('webhook-details', { webhook: webhookDetail, mode: 'read', scopes });
		});
	} catch(err) {
		showErrorMessage('Could not access webhook', err);
	}
}

export async function deleteWebhook(webhook: IWebhook, context: IContext) {
	try {
        const { system, event, id } = webhook;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing webhook: ${webhook.id}`,
			cancellable: false
		}, async (progress, token) => {
			await context.webhookClient.deleteHook(system, event, id);
		});
		vscode.window.showInformationMessage(`Webhook removed: ${id}`);
	} catch(err) {
		showErrorMessage('Could not remove webhook', err);
	}
}

export async function updateWebhook(webhook: IWebhook, context: IContext, successCallback?: () => void) {
	try {
		const { system, event, id } = webhook;
		let webhookDetail: IWebhookDetails | null = null;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Retrieving webhook data: ${webhook.id}`,
			cancellable: false
		}, async (progress, token) => {
			webhookDetail = await context.webhookClient.getHookDetails(system, event, id);
		});
		const scopes = webhookScopes(webhook.system);
		const panel = vscode.window.createWebviewPanel(
			'update-webhook',
			`Webhook: ${id}`,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('webhook-details', { webhook: webhookDetail, mode: 'update', scopes });
		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'update':
						vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: `Updating webhook ${id}`,
							cancellable: false
						}, async (progress, token) => {
							try {
								await context.webhookClient.updateHook(webhook.system, webhook.event, webhook.id, {
									//callbackUrl: message.webhook.status, // changing callback doesn't seem to be supported
									status: message.webhook.status,
									//scope: message.webhook.scope // changing scope doesn't seem to be supported
								});
								panel.dispose();
								vscode.window.showInformationMessage(`Webhook updated: ${id}`);
								if (successCallback) {
									successCallback();
								}
							} catch (err) {
								vscode.window.showErrorMessage(`Could not update webhook: ${err})`);
							}
						});
						break;
					case 'cancel':
						panel.dispose();
						break;
				}
			},
			undefined,
			context.extensionContext.subscriptions
		);
	} catch (err) {
		showErrorMessage('Could not retrieve webhook', err);
	}
}
