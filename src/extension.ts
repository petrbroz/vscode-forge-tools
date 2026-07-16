import * as vscode from 'vscode';
import { SimpleStorageDataProvider } from './providers/data-management';
import { DesignAutomationDataProvider }from './providers/design-automation';
import { IContext } from './common';
import { WebhooksDataProvider } from './providers/webhooks';
import { HubsDataProvider } from './providers/hubs';
import { IssuesDataProvider } from './providers/issues';
import { getEnvironments, setupNewEnvironment } from './environment';
import { IEnvironment } from './models/environment';
import { createServices, createSessionAuthenticationProvider } from './services';
import { ApsAuthenticationProvider } from './auth-provider';
import { SecureServiceAccountsDataProvider } from './providers/secure-service-accounts';
import { AuthenticationCommands } from './commands/authentication';
import { ObjectStorageServiceCommands } from './commands/object-storage';
import { DataManagementCommands } from './commands/data-management';
import { DesignAutomationCommands } from './commands/design-automation';
import { ModelDerivativesCommands } from './commands/model-derivative';
import { SecureServiceAccountsCommands } from './commands/secure-service-accounts';
import { WebhooksCommands } from './commands/webhooks';
import { IssuesCommands } from './commands/issues';
import { EnvironmentCommands } from './commands/environment';

export async function activate(_context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0) {
		// If no environment is configured, offer a guided process for creating one using vscode UI
		setupNewEnvironment();
		return;
	}
	let env = environments[0];

	let context: IContext = {
		extensionContext: _context,
        environment: env,
        ...createServices(env),
		previewSettings: {
			extensions: vscode.workspace.getConfiguration(undefined, null).get<string[]>('autodesk.forge.viewer.extensions') || [],
			env: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.env'),
			api: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.api')
		},
        log: vscode.window.createOutputChannel("Autodesk Platform Services", { log: true })
	};
    context.log.info('Extension has been loaded.');

    // Register the APS authentication provider (owns the single user-context session per environment).
    const authProvider = new ApsAuthenticationProvider(_context.secrets, () => context);
    context.extensionContext.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(ApsAuthenticationProvider.id, ApsAuthenticationProvider.label, authProvider, { supportsMultipleAccounts: false })
    );

	// Setup Data & Derivatives (app) view (OSS buckets/objects)
	let simpleStorageDataProvider = new SimpleStorageDataProvider(context);
	let dataManagementView = vscode.window.createTreeView('apsDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.extensionContext.subscriptions.push(dataManagementView);

	// Setup Data & Derivatives (user) view (Data Management hubs)
	let hubsDataProvider = new HubsDataProvider(context);
	let hubsView = vscode.window.createTreeView('apsHubsView', { treeDataProvider: hubsDataProvider });
	context.extensionContext.subscriptions.push(hubsView);

	// Setup Issues (user) view (ACC/BIM 360 issues)
	let issuesDataProvider = new IssuesDataProvider(context);
	let issuesView = vscode.window.createTreeView('apsIssuesView', { treeDataProvider: issuesDataProvider });
	context.extensionContext.subscriptions.push(issuesView);

    // Setup Automation (app) view
	let designAutomationDataProvider = new DesignAutomationDataProvider(context);
	let designAutomationView = vscode.window.createTreeView('apsDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.extensionContext.subscriptions.push(designAutomationView);

	// Setup Webhooks (app) and Webhooks (user) views
	let webhooksAppDataProvider = new WebhooksDataProvider(context, 'app');
	let webhooksAppView = vscode.window.createTreeView('apsWebhooksView', { treeDataProvider: webhooksAppDataProvider });
	context.extensionContext.subscriptions.push(webhooksAppView);
	let webhooksUserDataProvider = new WebhooksDataProvider(context, 'user');
	let webhooksUserView = vscode.window.createTreeView('apsWebhooksUserView', { treeDataProvider: webhooksUserDataProvider });
	context.extensionContext.subscriptions.push(webhooksUserView);
	const refreshWebhooks = () => { webhooksAppDataProvider.refresh(); webhooksUserDataProvider.refresh(); };

    // Setup Secure Service Accounts (app) view
    let secureServiceAccountsProvider = new SecureServiceAccountsDataProvider(context);
    let secureServiceAccountsView = vscode.window.createTreeView('apsSecureServiceAccountsView', { treeDataProvider: secureServiceAccountsProvider });
    context.extensionContext.subscriptions.push(secureServiceAccountsView);

	function updateUserSessionContext() {
		vscode.commands.executeCommand('setContext', 'aps:userSession', !!context.session);
	}

	/**
	 * Rebuilds every service for the given environment, restoring that environment's persisted session
	 * (if any) as the user-context provider. This is the single place the active session is applied -
	 * startup, sign-in/out, and environment switching all funnel through it.
	 */
	async function applySession(environment: IEnvironment) {
		const session = await authProvider.getStoredSession(environment);
		const userProvider = session
			? createSessionAuthenticationProvider(environment, session, updated => authProvider.updateStoredSession(environment, updated))
			: undefined;
		Object.assign(context, createServices(environment, userProvider));
		context.session = session;
		updateUserSessionContext();
	}

	function refreshAllViews() {
		simpleStorageDataProvider.refresh();
		hubsDataProvider.refresh();
		issuesDataProvider.refresh();
		designAutomationDataProvider.refresh();
		refreshWebhooks();
		secureServiceAccountsProvider.refresh();
	}

	const environmentCommands = new EnvironmentCommands(context, async () => {
		await applySession(context.environment);
		refreshAllViews();
		updateEnvironmentStatus(envStatusBarItem);
	});
	context.extensionContext.subscriptions.push(...environmentCommands.registerCommands());

    const authenticationCommands = new AuthenticationCommands(context, authProvider);
	context.extensionContext.subscriptions.push(...authenticationCommands.registerCommands());

	// A session added/removed via the provider (sign-in/out, or the VS Code Accounts menu) rebuilds the
	// services for the current environment and refreshes the user-context views.
	context.extensionContext.subscriptions.push(authProvider.onDidChangeSessions(async () => {
		await applySession(context.environment);
		hubsDataProvider.refresh();
		issuesDataProvider.refresh();
		refreshWebhooks();
	}));

	const objectStorageServiceCommands = new ObjectStorageServiceCommands(context, () => simpleStorageDataProvider.refresh());
	context.extensionContext.subscriptions.push(...objectStorageServiceCommands.registerCommands());

	const dataManagementCommands = new DataManagementCommands(context, () => {
		simpleStorageDataProvider.refresh();
		hubsDataProvider.refresh();
	});
	context.extensionContext.subscriptions.push(...dataManagementCommands.registerCommands());

	const modelDerivativeCommands = new ModelDerivativesCommands(context, () => {
        simpleStorageDataProvider.refresh();
        hubsDataProvider.refresh();
    });
	context.extensionContext.subscriptions.push(...modelDerivativeCommands.registerCommands());

	const designAutomationCommands = new DesignAutomationCommands(context, () => designAutomationDataProvider.refresh());
	context.extensionContext.subscriptions.push(...designAutomationCommands.registerCommands());

	const webhooksCommands = new WebhooksCommands(context, refreshWebhooks);
	context.extensionContext.subscriptions.push(...webhooksCommands.registerCommands());

	const secureServiceAccountsCommands = new SecureServiceAccountsCommands(context, () => secureServiceAccountsProvider.refresh());
	context.extensionContext.subscriptions.push(...secureServiceAccountsCommands.registerCommands());

	const issuesCommands = new IssuesCommands(context, () => issuesDataProvider.refresh());
	context.extensionContext.subscriptions.push(...issuesCommands.registerCommands());

	function updateEnvironmentStatus(statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = 'APS Env: ' + context.environment.title;
		statusBarItem.command = 'aps.switchEnvironment';
		statusBarItem.show();
	}
	const envStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.extensionContext.subscriptions.push(envStatusBarItem);
	updateEnvironmentStatus(envStatusBarItem);

	// Restore the startup environment's persisted session (if any).
	await applySession(env);
}

export function deactivate() { }
