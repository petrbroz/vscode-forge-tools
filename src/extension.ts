import * as vscode from 'vscode';
import { AuthenticationClient, DataManagementClient, ModelDerivativeClient, DesignAutomationClient, WebhooksClient, BIM360Client } from 'aps-sdk-node';
import { SimpleStorageDataProvider } from './providers/data-management';
import { DesignAutomationDataProvider }from './providers/design-automation';
import { Region } from 'aps-sdk-node/dist/common';
import { IContext } from './common';
import { WebhooksDataProvider } from './providers/webhooks';
import { HubsDataProvider } from './providers/hubs';
import { getEnvironments, setupNewEnvironment, DesignAutomationRegion } from './environment';
import { ClientCredentialsAuthenticationProvider, createSecureServiceAccountsClient, DefaultRequestAdapter } from './clients';
import { SecureServiceAccountsDataProvider } from './providers/secure-service-accounts';
import { registerAuthenticationCommands } from './commands/authentication';
import { registerDataManagementCommands } from './commands/data-management';
import { registerDesignAutomationCommands } from './commands/design-automation';
import { registerModelDerivativeCommands } from './commands/model-derivative';
import { SecureServiceAccountsCommands } from './commands/secure-service-accounts';
import { registerWebhookCommands } from './commands/webhooks';
import { registerEnvironmentCommands } from './commands/environment';

export function activate(_context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0) {
		// If no environment is configured, offer a guided process for creating one using vscode UI
		setupNewEnvironment();
		return;
	}
	let env = environments[0];

    let defaultRequestAdapter = new DefaultRequestAdapter(new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret));
	let context: IContext = {
		extensionContext: _context,
		credentials: { client_id: env.clientId, client_secret: env.clientSecret },
        environment: env,
		authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret, env.host),
		dataManagementClient: new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }, env.host, env.region as Region),
		modelDerivativeClient2L: new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }, env.host, env.region as Region),
		modelDerivativeClient3L: new ModelDerivativeClient({ token: '' }, env.host, env.region as Region),
		designAutomationClient: new DesignAutomationClient({ client_id: env.clientId, client_secret: env.clientSecret }, env.host, env.region as Region, env.designAutomationRegion as DesignAutomationRegion),
		webhookClient: new WebhooksClient({ client_id: env.clientId, client_secret: env.clientSecret }, env.host, env.region as Region),
		bim360Client: new BIM360Client({ client_id: env.clientId, client_secret: env.clientSecret }, env.host, env.region as Region),
        secureServiceAccountsClient: createSecureServiceAccountsClient(defaultRequestAdapter),
		previewSettings: {
			extensions: vscode.workspace.getConfiguration(undefined, null).get<string[]>('autodesk.forge.viewer.extensions') || [],
			env: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.env'),
			api: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.api')
		},
        log: vscode.window.createOutputChannel("Autodesk Platform Services", { log: true })
	};
    context.log.info('Extension has been loaded.');

	// Setup buckets view
	let simpleStorageDataProvider = new SimpleStorageDataProvider(context);
	let dataManagementView = vscode.window.createTreeView('apsDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.extensionContext.subscriptions.push(dataManagementView);

	// Setup hubs view
	let hubsDataProvider = new HubsDataProvider(context);
	let hubsView = vscode.window.createTreeView('apsHubsView', { treeDataProvider: hubsDataProvider });
	context.extensionContext.subscriptions.push(hubsView);

    // Setup design automation view
	let designAutomationDataProvider = new DesignAutomationDataProvider(context);
	let designAutomationView = vscode.window.createTreeView('apsDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.extensionContext.subscriptions.push(designAutomationView);

	// Setup webhooks view
	let webhooksDataProvider = new WebhooksDataProvider(context);
	let webhooksView = vscode.window.createTreeView('apsWebhooksView', { treeDataProvider: webhooksDataProvider });
	context.extensionContext.subscriptions.push(webhooksView);

    // Setup secure service accounts view
    let secureServiceAccountsProvider = new SecureServiceAccountsDataProvider(context);
    let secureServiceAccountsView = vscode.window.createTreeView('apsSecureServiceAccountsView', { treeDataProvider: secureServiceAccountsProvider });
    context.extensionContext.subscriptions.push(secureServiceAccountsView);

	registerEnvironmentCommands(context, () => {
        simpleStorageDataProvider.refresh();
        designAutomationDataProvider.refresh();
        hubsDataProvider.refresh();
        webhooksDataProvider.refresh();
        secureServiceAccountsProvider.refresh();
        updateEnvironmentStatus(envStatusBarItem);
	});
    registerAuthenticationCommands(context, () => {
		hubsDataProvider.refresh();
		updateAuthStatus(authStatusBarItem);
	});
	registerDataManagementCommands(context, () => {
		simpleStorageDataProvider.refresh();
		hubsDataProvider.refresh();
	});
	registerModelDerivativeCommands(context, () => {
        simpleStorageDataProvider.refresh();
        hubsDataProvider.refresh();
    });
	registerDesignAutomationCommands(context, () => designAutomationDataProvider.refresh());
	registerWebhookCommands(context, () => webhooksDataProvider.refresh());
	const secureServiceAccountsCommands = new SecureServiceAccountsCommands(context, () => secureServiceAccountsProvider.refresh());
	context.extensionContext.subscriptions.push(...secureServiceAccountsCommands.registerCommands());

	function updateEnvironmentStatus(statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = 'APS Env: ' + env.title;
		statusBarItem.command = 'forge.switchEnvironment';
		statusBarItem.show();
	}
	const envStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.extensionContext.subscriptions.push(envStatusBarItem);
	updateEnvironmentStatus(envStatusBarItem);

	function updateAuthStatus(statusBarItem: vscode.StatusBarItem) {
		if (context.threeLeggedToken) {
			statusBarItem.text = 'APS Auth: 3-legged';
			statusBarItem.command = 'forge.logout';
		} else {
			statusBarItem.text = 'APS Auth: 2-legged';
			statusBarItem.command = 'forge.login';
		}
		statusBarItem.show();
	}
	const authStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.extensionContext.subscriptions.push(authStatusBarItem);
	updateAuthStatus(authStatusBarItem);
}

export function deactivate() { }
