import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IWebhook } from '../providers/webhooks';

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
			panel.webview.html = context.templateEngine.render('webhook-details', { webhook: webhookDetail });
		});
	} catch(err) {
		showErrorMessage('Could not access webhook', err);
	}
}
