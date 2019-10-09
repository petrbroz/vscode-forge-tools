import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook, IWebhookEvent } from '../providers/webhooks';
import { WebhookSystem } from 'forge-server-utils';

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
		'webhook-details',
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
					context.webhookClient.createHook(entry.system, entry.event, {
						callbackUrl: message.webhook.callbackUrl,
						scope: message.webhook.scope
					})
					.then(id => {
						panel.dispose();
						vscode.window.showInformationMessage(`Webhook created: ${id as string}`);
						if (successCallback) {
							successCallback();
						}
					})
					.catch(err => {
						vscode.window.showErrorMessage(`Could not create webhook: ${err})`);
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
