import * as vscode from 'vscode';
import {
	AuthenticationClient,
	IBucket,
	IObject,
	DataManagementClient,
	ModelDerivativeClient,
	DesignAutomationClient,
	WebhooksClient,
	BIM360Client,
	IActivityDetail
} from 'forge-server-utils';
import * as dmp from './providers/data-management';
import * as dap from './providers/design-automation';
import * as dmc from './commands/data-management';
import * as mdc from './commands/model-derivative';
import * as dac from './commands/design-automation';
import * as dai from './interfaces/design-automation';
import * as mdi from './interfaces/model-derivative';
import * as hi  from './interfaces/hubs';
import { Region } from 'forge-server-utils/dist/common';
import { IContext } from './common';
import { WebhooksDataProvider, IWebhook, IWebhookEvent } from './providers/webhooks';
import { viewWebhookDetails, createWebhook, deleteWebhook, updateWebhook } from './commands/webhooks';
import { login, getAccessToken } from './commands/authentication';
import { HubsDataProvider } from './providers/hubs';
import { getEnvironments, setupNewEnvironment, IEnvironment } from './environments';

const DefaultAuthPort = 8123;

// TODO: reuse the enum from forge-server-utils
enum DesignAutomationRegion {
    US_WEST = 'us-west',
    US_EAST = 'us-east'
}

export function activate(_context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0) {
		// If no environment is configured, offer a guided process for creating one using vscode UI
		setupNewEnvironment();
		return;
	}
	let env = environments[0];

	console.log('Extension "autodesk-platform-services" has been loaded.');

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
		previewSettings: {
			extensions: vscode.workspace.getConfiguration(undefined, null).get<string[]>('autodesk.forge.viewer.extensions') || [],
			env: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.env'),
			api: vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.viewer.api')
		}
	};

	// Setup buckets view
	let simpleStorageDataProvider = new dmp.SimpleStorageDataProvider(context);
	let dataManagementView = vscode.window.createTreeView('apsDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.extensionContext.subscriptions.push(dataManagementView);

	// Setup hubs view
	let hubsDataProvider = new HubsDataProvider(context);
	let hubsView = vscode.window.createTreeView('apsHubsView', { treeDataProvider: hubsDataProvider });
	context.extensionContext.subscriptions.push(hubsView);

    // Setup design automation view
	let designAutomationDataProvider = new dap.DesignAutomationDataProvider(context);
	let designAutomationView = vscode.window.createTreeView('apsDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.extensionContext.subscriptions.push(designAutomationView);

	// Setup webhooks view
	let webhooksDataProvider = new WebhooksDataProvider(context);
	let webhooksView = vscode.window.createTreeView('apsWebhooksView', { treeDataProvider: webhooksDataProvider });
	context.extensionContext.subscriptions.push(webhooksView);

	registerDataManagementCommands(simpleStorageDataProvider, context);
	registerModelDerivativeCommands(context, simpleStorageDataProvider, hubsDataProvider);
	registerDesignAutomationCommands(designAutomationDataProvider, context);
	registerWebhookCommands(webhooksDataProvider, context);

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

	vscode.commands.registerCommand('forge.login', async () => {
		try {
			const port = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.authentication.port') || DefaultAuthPort;
			const data = await login(env.clientId, port, context);
			const token = data.get('access_token');
			const expires = data.get('expires_in');
			const tokenType = data.get('token_type');
			if (!token || !expires || tokenType !== 'Bearer') {
				throw new Error('Authentication data missing or incorrect.');
			}
			context.threeLeggedToken = token;
			context.bim360Client.reset({ token: context.threeLeggedToken }, env.host, env.region as Region);
			delete (context.bim360Client as any).auth; // TODO: remove 'auth' in the reset method
			context.modelDerivativeClient3L.reset({ token: context.threeLeggedToken }, env.host, env.region as Region);
			hubsDataProvider.refresh();
			updateAuthStatus(authStatusBarItem);
			vscode.window.showInformationMessage(`You are now logged in. Autodesk Platform Services requiring 3-legged authentication will be available for as long as the generated token is valid (${expires} seconds), or until you manually log out.`);
		} catch (err) {
			vscode.window.showWarningMessage(`Could not log in: ${err}`);
		}
	});

	vscode.commands.registerCommand('forge.logout', async () => {
		const answer = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Would you like to log out?' });
		if (answer === 'Yes') {
			delete context.threeLeggedToken;
			context.bim360Client.reset(context.credentials, env.host, env.region as Region);
			delete (context.bim360Client as any).token; // TODO: remove 'token' in the reset method
			context.modelDerivativeClient3L.reset({ token: '' }, env.host, env.region as Region);
			hubsDataProvider.refresh();
			updateAuthStatus(authStatusBarItem);
			vscode.window.showInformationMessage(`You are now logged out. Autodesk Platform Services requiring 3-legged authentication will no longer be available.`);
		}
	});

	vscode.commands.registerCommand('forge.switchEnvironment', async () => {
		const environments = getEnvironments();
		const name = await vscode.window.showQuickPick(environments.map(env => env.title), { placeHolder: 'Select APS environment' });
		if (!name) {
			return;
		}
		env = environments.find(environment => environment.title === name) as IEnvironment;
		delete context.threeLeggedToken;
		context.credentials = { client_id: env.clientId, client_secret: env.clientSecret };
		context.dataManagementClient.reset(context.credentials, env.host, env.region as Region);
		context.modelDerivativeClient2L.reset(context.credentials, env.host, env.region as Region);
		context.modelDerivativeClient3L.reset({ token: '' }, env.host, env.region as Region);
		context.designAutomationClient.reset(context.credentials, env.host, env.region as Region, env.designAutomationRegion as DesignAutomationRegion);
		context.webhookClient.reset(context.credentials, env.host, env.region as Region);
		context.bim360Client.reset(context.credentials, env.host, env.region as Region);
		context.authenticationClient = new AuthenticationClient(env.clientId, env.clientSecret, env.host);
		simpleStorageDataProvider.refresh();
		designAutomationDataProvider.refresh();
		hubsDataProvider.refresh();
		webhooksDataProvider.refresh();
		updateEnvironmentStatus(envStatusBarItem);
	});
}

function registerWebhookCommands(webhooksDataProvider: WebhooksDataProvider, context: IContext) {
    vscode.commands.registerCommand('forge.refreshWebhooks', () => {
        webhooksDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createWebhook', async (event: IWebhookEvent) => {
        // TODO: create webhooks from command palette
        await createWebhook(event, context, function () {
            webhooksDataProvider.refresh(event);
        });
    });
    vscode.commands.registerCommand('forge.updateWebhook', async (webhook: IWebhook) => {
        // TODO: update webhooks from command palette
        await updateWebhook(webhook, context, function () {
            webhooksDataProvider.refresh();
        });
    });
    vscode.commands.registerCommand('forge.deleteWebhook', async (webhook: IWebhook) => {
        // TODO: delete webhooks from command palette
        await deleteWebhook(webhook, context);
        webhooksDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.viewWebhookDetails', async (webhook: IWebhook) => {
        // TODO: view webhook details from command palette
        await viewWebhookDetails(webhook, context);
    });

    // Setup the rest	
    vscode.commands.registerCommand('forge.getAccessToken', async () => {
        await getAccessToken(context);
    });
}

function registerDesignAutomationCommands(designAutomationDataProvider: dap.DesignAutomationDataProvider, context: IContext) {
    vscode.commands.registerCommand('forge.refreshDesignAutomationTree', () => {
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createAppBundle', async () => {
        await dac.uploadAppBundle(undefined, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.updateAppBundle', async (entry?: dai.IAppBundleEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.uploadAppBundle(entry.appbundle, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.viewAppBundleDetails', async (entry?: dai.IAppBundleAliasEntry | dai.ISharedAppBundleEntry) => {
        if (entry) {
            await dac.viewAppBundleDetails('fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`, context);
        } else {
            await dac.viewAppBundleDetails(undefined, context);
        }
    });
    vscode.commands.registerCommand('forge.viewAppBundleAliasDetails', async (entry?: dai.IAppBundleAliasEntry) => {
        await dac.viewAppBundleAliasDetails(entry ? `${entry.client}.${entry.appbundle}+${entry.alias}` : undefined, context);
    });
    vscode.commands.registerCommand('forge.viewAppBundleVersionDetails', async (entry?: dai.IAppBundleVersionEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.viewAppBundleDetails({ name: entry.appbundle, version: entry.version }, context);
    });
    vscode.commands.registerCommand('forge.deleteAppBundle', async (entry?: dai.IAppBundleEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteAppBundle(entry.appbundle, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.deleteAppBundleAlias', async (entry?: dai.IAppBundleAliasEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteAppBundleAlias(entry.appbundle, entry.alias, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createAppBundleAlias', async (entry?: dai.IAppBundleAliasesEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.createAppBundleAlias(entry.appbundle, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.updateAppBundleAlias', async (entry?: dai.IAppBundleAliasEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.updateAppBundleAlias(entry.appbundle, entry.alias, context);
    });
    vscode.commands.registerCommand('forge.deleteAppBundleVersion', async (entry?: dai.IAppBundleVersionEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteAppBundleVersion(entry.appbundle, entry.version, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.viewActivityDetails', async (entry?: dai.IActivityAliasEntry | dai.ISharedActivityEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
        await dac.viewActivityDetails(id, context);
    });
    vscode.commands.registerCommand('forge.viewActivityAliasDetails', async (entry?: dai.IActivityAliasEntry) => {
        await dac.viewActivityAliasDetails(entry ? `${entry.client}.${entry.activity}+${entry.alias}` : undefined, context);
    });
    vscode.commands.registerCommand('forge.viewActivityVersionDetails', async (entry?: dai.IActivityVersionEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.viewActivityDetails({ name: entry.activity, version: entry.version }, context);
    });
    vscode.commands.registerCommand('forge.deleteActivity', async (entry?: dai.IActivityEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteActivity(entry.activity, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.deleteActivityAlias', async (entry?: dai.IActivityAliasEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteActivityAlias(entry.activity, entry.alias, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createActivity', async () => {
        await dac.createActivity(
            (activity: IActivityDetail) => { designAutomationDataProvider.refresh(); },
            context
        );
    });
    vscode.commands.registerCommand('forge.updateActivity', async (entry?: dai.IActivityAliasEntry | dai.IActivityVersionEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.updateActivity(
            'alias' in entry ? `${entry.client}.${entry.activity}+${entry.alias}` : { name: entry.activity, version: entry.version },
            (activity: IActivityDetail) => { designAutomationDataProvider.refresh(); },
            context
        );
    });
    vscode.commands.registerCommand('forge.createActivityAlias', async (entry?: dai.IActivityAliasesEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.createActivityAlias(entry.activity, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.updateActivityAlias', async (entry?: dai.IActivityAliasEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.updateActivityAlias(entry.activity, entry.alias, context);
    });
    vscode.commands.registerCommand('forge.deleteActivityVersion', async (entry?: dai.IActivityVersionEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.deleteActivityVersion(entry.activity, entry.version, context);
        designAutomationDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createWorkitem', async (entry?: dai.IActivityAliasEntry | dai.ISharedActivityEntry) => {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await dac.createWorkitem(('fullid' in entry) ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`, context);
    });
}

function registerModelDerivativeCommands(context: IContext, simpleStorageDataProvider: dmp.SimpleStorageDataProvider, hubsDataProvider: HubsDataProvider) {
    vscode.commands.registerCommand('forge.translateObject', async (object?: IObject | hi.IVersion) => {
        await mdc.translateObject(object, context);
        simpleStorageDataProvider.refresh((object as IObject));
        hubsDataProvider.refresh((object as hi.IVersion));
    });
    vscode.commands.registerCommand('forge.translateObjectCustom', async (object?: IObject | hi.IVersion) => {
        await mdc.translateObjectCustom(object, context, () => {
            simpleStorageDataProvider.refresh((object as IObject));
            hubsDataProvider.refresh((object as hi.IVersion));
        });
    });
    vscode.commands.registerCommand('forge.listViewables', async (object?: IObject | hi.IVersion) => {
        await mdc.listViewables(object, context);
    });
    vscode.commands.registerCommand('forge.previewDerivative', async (derivative?: mdi.IDerivative) => {
        await mdc.previewDerivative(derivative, context);
    });
    vscode.commands.registerCommand('forge.viewDerivativeTree', async (derivative?: mdi.IDerivative) => {
        await mdc.viewDerivativeTree(derivative, context);
    });
    vscode.commands.registerCommand('forge.viewDerivativeProps', async (derivative?: mdi.IDerivative) => {
        await mdc.viewDerivativeProps(derivative, context);
    });
    vscode.commands.registerCommand('forge.viewObjectManifest', async (object?: IObject | hi.IVersion) => {
        await mdc.viewObjectManifest(object, context);
    });
    vscode.commands.registerCommand('forge.deleteObjectManifest', async (object?: IObject) => {
        await mdc.deleteObjectManifest(object, context);
        simpleStorageDataProvider.refresh(object);
    });
    vscode.commands.registerCommand('forge.viewObjectThumbnail', async (object?: IObject | hi.IVersion) => {
        await mdc.viewObjectThumbnail(object, context);
    });
    vscode.commands.registerCommand('forge.downloadDerivativeSvf', async (object?: IObject) => {
        await mdc.downloadDerivativesSVF(object, context);
    });
    vscode.commands.registerCommand('forge.downloadDerivativeF2d', async (object?: IObject) => {
        await mdc.downloadDerivativesF2D(object, context);
    });
    vscode.commands.registerCommand('forge.downloadDerivativeGltf', async (object?: IObject) => {
        await mdc.downloadDerivativeGLTF(object, context);
    });
    vscode.commands.registerCommand('forge.copyObjectUrn', async (object?: IObject | hi.IVersion) => {
        await mdc.copyObjectUrn(object, context);
    });
}

function registerDataManagementCommands(simpleStorageDataProvider: dmp.SimpleStorageDataProvider, context: IContext) {
    vscode.commands.registerCommand('forge.refreshBuckets', () => {
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createBucket', async () => {
        await dmc.createBucket(context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.viewBucketDetails', async (bucket?: IBucket) => {
        await dmc.viewBucketDetails(bucket, context);
    });
    vscode.commands.registerCommand('forge.copyBucketKey', async (bucket?: IBucket) => {
        await dmc.copyBucketKey(bucket, context);
    });
    vscode.commands.registerCommand('forge.deleteBucketObjects', async (bucket?: IBucket) => {
        await dmc.deleteAllObjects(bucket, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.viewObjectDetails', async (object?: IObject) => {
        await dmc.viewObjectDetails(object, context);
    });
    vscode.commands.registerCommand('forge.copyObjectKey', async (object?: IObject) => {
        await dmc.copyObjectKey(object, context);
    });
    vscode.commands.registerCommand('forge.uploadObject', async (bucket?: IBucket) => {
        await dmc.uploadObject(bucket, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.createEmptyObject', async (bucket?: IBucket) => {
        await dmc.createEmptyObject(bucket, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.copyObject', async (object?: IObject) => {
        await dmc.copyObject(object, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.renameObject', async (object?: IObject) => {
        await dmc.renameObject(object, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.downloadObject', async (object?: IObject) => {
        await dmc.downloadObject(object, context);
    });
    vscode.commands.registerCommand('forge.deleteObject', async (object?: IObject) => {
        await dmc.deleteObject(object, context);
        simpleStorageDataProvider.refresh();
    });
    vscode.commands.registerCommand('forge.generateSignedUrl', async (object?: IObject) => {
        await dmc.generateSignedUrl(object, context);
    });
    vscode.commands.registerCommand('forge.deleteBucket', async (bucket?: IBucket) => {
        await dmc.deleteBucket(bucket, context);
        simpleStorageDataProvider.refresh();
    });
}

export function deactivate() { }
