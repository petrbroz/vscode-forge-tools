import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook } from '../providers/webhooks';
import { WebhookSystem } from 'forge-server-utils';

export async function viewWebhookDetails(webhook: IWebhook, context: IContext) {
	try {
        const { system, event, id } = webhook;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting webhook details: ${webhook.id}`,
			cancellable: false
		}, async (progress, token) => {
			const webhookDetail = await context.webhookClient.getHookDetails(system, event, id);
			const panel = vscode.window.createWebviewPanel(
				'webhook-details',
				`Webhook: ${id}`,
				vscode.ViewColumn.One,
				{ enableScripts: false }
			);

			// Collect scope keys available for specific webhook system
			let scopes: string[] = [];
			switch (webhook.system) {
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

			panel.webview.html = context.templateEngine.render('webhook-details', { webhook: webhookDetail, mode: 'read', scopes });
		});
	} catch(err) {
		showErrorMessage('Could not access webhook', err);
	}
}
