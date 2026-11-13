import * as vscode from 'vscode';
import { SimpleStorageDataProvider } from './providers/data-management';
import { DesignAutomationDataProvider }from './providers/design-automation';
import { IContext } from './common';
import { BaseTreeProvider } from './providers/base';
import { WebhooksDataProvider, WebhookDecorationProvider } from './providers/webhooks';
import { HubsDataProvider } from './providers/hubs';
import { IssuesDataProvider } from './providers/issues';
import { getEnvironments, pickDefaultEnvironment, setupNewEnvironment } from './environment';
import { IEnvironment } from './models/environment';
import { createServices, createSessionAuthenticationProvider } from './services';
import { ApsAuthenticationProvider } from './auth-provider';
import { SecureServiceAccountsDataProvider } from './providers/secure-service-accounts';
import { HubAdminDataProvider } from './providers/hub-admin';
import { TeamAdminDataProvider, TEAM_ADMIN_ENABLED_SETTING } from './providers/team-admin';
import { ReadOnlyContentProvider, READONLY_SCHEME } from './providers/readonly-content';
import { AuthenticationCommands } from './commands/authentication';
import { ObjectStorageServiceCommands } from './commands/object-storage';
import { DataManagementCommands } from './commands/data-management';
import { DesignAutomationCommands } from './commands/design-automation';
import { ModelDerivativesCommands } from './commands/model-derivative';
import { SecureServiceAccountsCommands } from './commands/secure-service-accounts';
import { WebhooksCommands } from './commands/webhooks';
import { HubAdminCommands } from './commands/hub-admin';
import { TeamAdminCommands } from './commands/team-admin';
import { IssuesCommands } from './commands/issues';
import { EnvironmentCommands } from './commands/environment';
import { ApsLanguageModelTools } from './tools';

export async function activate(_context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0) {
		// If no environment is configured, offer a guided process for creating one using vscode UI
		setupNewEnvironment();
		return;
	}
	// Restores the environment last selected in this workspace, if it's still configured (see `EnvironmentCommands.switchEnvironment`).
	let env = pickDefaultEnvironment(environments, _context.workspaceState);

	const readOnlyContentProvider = new ReadOnlyContentProvider();
	let context: IContext = {
		extensionContext: _context,
        environment: env,
        ...createServices(env),
		previewSettings: {
			extensions: vscode.workspace.getConfiguration(undefined, null).get<string[]>('autodesk.forge.viewer.extensions') || [],
			env: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.env'),
			api: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.api')
		},
        log: vscode.window.createOutputChannel("Autodesk Platform Services", { log: true }),
        readOnlyContentProvider
	};
    context.log.info('Extension has been loaded.');
    context.extensionContext.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(READONLY_SCHEME, readOnlyContentProvider));

    // Register the APS authentication provider (owns the single user-context session per environment).
    const authProvider = new ApsAuthenticationProvider(_context.secrets, () => context);
    context.extensionContext.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(ApsAuthenticationProvider.id, ApsAuthenticationProvider.label, authProvider, { supportsMultipleAccounts: false })
    );
    // Delivers the OAuth redirect for the 3-legged login flows (see ApsAuthenticationProvider.handleUri).
    context.extensionContext.subscriptions.push(vscode.window.registerUriHandler(authProvider));

	// All tree views, flagged by whether they depend on the user (3-legged) session.
	const simpleStorageDataProvider = new SimpleStorageDataProvider(context);
	const hubsDataProvider = new HubsDataProvider(context);
	const issuesDataProvider = new IssuesDataProvider(context);
	const designAutomationDataProvider = new DesignAutomationDataProvider(context);
	const webhooksAppDataProvider = new WebhooksDataProvider(context, 'app');
	const webhooksUserDataProvider = new WebhooksDataProvider(context, 'user');
	const secureServiceAccountsProvider = new SecureServiceAccountsDataProvider(context);
	const hubAdminAppDataProvider = new HubAdminDataProvider(context, 'app');
	const hubAdminUserDataProvider = new HubAdminDataProvider(context, 'user');
	const teamAdminDataProvider = new TeamAdminDataProvider(context);
	const providers: { viewId: string; provider: BaseTreeProvider<any>; user: boolean; dragAndDrop?: boolean }[] = [
		{ viewId: 'apsDataManagementView', provider: simpleStorageDataProvider, user: false, dragAndDrop: true },
		{ viewId: 'apsHubsView', provider: hubsDataProvider, user: true },
		{ viewId: 'apsIssuesView', provider: issuesDataProvider, user: true },
		{ viewId: 'apsDesignAutomationView', provider: designAutomationDataProvider, user: false },
		{ viewId: 'apsWebhooksView', provider: webhooksAppDataProvider, user: false },
		{ viewId: 'apsWebhooksUserView', provider: webhooksUserDataProvider, user: true },
		{ viewId: 'apsSecureServiceAccountsView', provider: secureServiceAccountsProvider, user: false },
		{ viewId: 'apsHubAdminAppView', provider: hubAdminAppDataProvider, user: false },
		{ viewId: 'apsHubAdminUserView', provider: hubAdminUserDataProvider, user: true },
		{ viewId: 'apsTeamAdminView', provider: teamAdminDataProvider, user: true }
	];
	for (const { viewId, provider, dragAndDrop } of providers) {
		const view = vscode.window.createTreeView(viewId, {
			treeDataProvider: provider,
			...(dragAndDrop ? { dragAndDropController: provider as unknown as vscode.TreeDragAndDropController<any> } : {})
		});
		context.extensionContext.subscriptions.push(view);
	}
	const webhookDecorationProvider = new WebhookDecorationProvider();
	context.extensionContext.subscriptions.push(vscode.window.registerFileDecorationProvider(webhookDecorationProvider));
	const refreshWebhooks = () => { webhooksAppDataProvider.refresh(); webhooksUserDataProvider.refresh(); webhookDecorationProvider.refresh(); };
	const refreshHubAdmin = () => { hubAdminAppDataProvider.refresh(); hubAdminUserDataProvider.refresh(); };
	const refreshUserViews = () => providers.filter(p => p.user).forEach(p => p.provider.refresh());
	const refreshAllViews = () => providers.forEach(p => p.provider.refresh());

	context.extensionContext.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(TEAM_ADMIN_ENABLED_SETTING)) {
			teamAdminDataProvider.refresh();
		}
	}));

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
		refreshUserViews();
	}));

	const objectStorageServiceCommands = new ObjectStorageServiceCommands(
		context,
		() => simpleStorageDataProvider.refresh(),
		(parentKey) => simpleStorageDataProvider.loadMore(parentKey),
		(bucketKey) => simpleStorageDataProvider.getFilter(bucketKey),
		(bucketKey, prefix) => simpleStorageDataProvider.setFilter(bucketKey, prefix)
	);
	context.extensionContext.subscriptions.push(...objectStorageServiceCommands.registerCommands());

	const dataManagementCommands = new DataManagementCommands(
		context,
		() => {
			simpleStorageDataProvider.refresh();
			hubsDataProvider.refresh();
		},
		(parentId) => hubsDataProvider.loadMore(parentId)
	);
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

	const hubAdminCommands = new HubAdminCommands(context, refreshHubAdmin);
	context.extensionContext.subscriptions.push(...hubAdminCommands.registerCommands());

	const issuesCommands = new IssuesCommands(context, () => issuesDataProvider.refresh());
	context.extensionContext.subscriptions.push(...issuesCommands.registerCommands());

	const teamAdminCommands = new TeamAdminCommands(context, () => teamAdminDataProvider.refresh());
	context.extensionContext.subscriptions.push(...teamAdminCommands.registerCommands());

	// Language model tools for operating on APS resources from VS Code chat (agent mode)
	const languageModelTools = new ApsLanguageModelTools(context, () => simpleStorageDataProvider.refresh(), refreshWebhooks);
	context.extensionContext.subscriptions.push(...languageModelTools.registerTools());

	function updateEnvironmentStatus(statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = 'APS Env: ' + context.environment.title;
		statusBarItem.command = 'aps.switchEnvironment';
		statusBarItem.show();
	}
	const envStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.extensionContext.subscriptions.push(envStatusBarItem);
	updateEnvironmentStatus(envStatusBarItem);

	// Restore the startup environment's persisted session (if any). The tree views above were already
	// created (and rendered empty) before this resolves, so the user-context views need an explicit
	// refresh to pick up the restored session.
	await applySession(env);
	refreshUserViews();

	// Hand-edited settings.json changes rebuild the services, status bar and views (same path as switching environments).
	context.extensionContext.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
		if (!event.affectsConfiguration('autodesk.forge')) {
			return;
		}
		const config = vscode.workspace.getConfiguration(undefined, null);
		context.previewSettings = {
			extensions: config.get<string[]>('autodesk.forge.viewer.extensions') || [],
			env: config.get<string>('autodesk.forge.viewer.env'),
			api: config.get<string>('autodesk.forge.viewer.api')
		};
		if (event.affectsConfiguration('autodesk.forge.environments')) {
			const updated = getEnvironments();
			if (updated.length === 0) {
				return; // keep the current environment until a new one is configured
			}
			context.environment = updated.find(e => e.title === context.environment.title)
				?? pickDefaultEnvironment(updated, context.extensionContext.workspaceState);
			await applySession(context.environment);
			refreshAllViews();
			updateEnvironmentStatus(envStatusBarItem);
		}
	}));
}

export function deactivate() { }
