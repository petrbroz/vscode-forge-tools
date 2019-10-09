import * as vscode from 'vscode';
import {
	AuthenticationClient,
	IBucket,
	IObject,
	DataManagementClient,
	ModelDerivativeClient,
	DesignAutomationClient,
	WebhooksClient,
	IActivityDetail
} from 'forge-server-utils';
import * as dmp from './providers/data-management';
import * as dap from './providers/design-automation';
import * as dmc from './commands/data-management';
import * as mdc from './commands/model-derivative';
import * as dac from './commands/design-automation';
import * as dai from './interfaces/design-automation';
import * as mdi from './interfaces/model-derivative';
import { Region } from 'forge-server-utils/dist/common';
import { TemplateEngine, IContext } from './common';
import { WebhooksDataProvider, IWebhook, IWebhookEvent } from './providers/webhooks';
import { viewWebhookDetails, createWebhook, deleteWebhook } from './commands/webhooks';

interface IEnvironment {
	title: string;
	clientId: string;
	clientSecret: string;
	region: string;
}

function getEnvironments(): IEnvironment[] {
	let environments = vscode.workspace.getConfiguration(undefined, null).get<IEnvironment[]>('autodesk.forge.environments') || [];
	if (environments.length === 0) {
		// See if there are extension settings using the old format
		const oldClientId = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.clientId') || '';
		const oldClientSecret = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.clientSecret') || '';
		const oldDataRegion = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.dataRegion') || 'US';
		if (oldClientId && oldClientSecret) {
			vscode.window.showInformationMessage('The settings format has changed. Please see the README for more details.');
			environments.push({
				title: '(no title)',
				clientId: oldClientId,
				clientSecret: oldClientSecret,
				region: oldDataRegion
			});
		}
	}
	return environments;
}

export function activate(_context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0 || !environments[0].clientId || !environments[0].clientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}
	let env = environments[0];

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let context: IContext = {
		extensionContext: _context,
		credentials: { client_id: env.clientId, client_secret: env.clientSecret },
		authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret),
		dataManagementClient: new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		modelDerivativeClient: new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		designAutomationClient: new DesignAutomationClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		webhookClient: new WebhooksClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		templateEngine: new TemplateEngine(_context)
	};

	// Setup data management view
	let simpleStorageDataProvider = new dmp.SimpleStorageDataProvider(context);
	let dataManagementView = vscode.window.createTreeView('forgeDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.extensionContext.subscriptions.push(dataManagementView);

	// Data management commands
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
	vscode.commands.registerCommand('forge.deleteBucketObjects', async (bucket?: IBucket) => {
		await dmc.deleteAllObjects(bucket, context);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.viewObjectDetails', async (object?: IObject) => {
		await dmc.viewObjectDetails(object, context);
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

	// Model derivative commands
	vscode.commands.registerCommand('forge.translateObject', async (object?: IObject) => {
		await mdc.translateObject(object, false, context);
		simpleStorageDataProvider.refresh(object);
	});
	vscode.commands.registerCommand('forge.translateArchive', async (object?: IObject) => {
		await mdc.translateObject(object, true, context);
		simpleStorageDataProvider.refresh(object);
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
	vscode.commands.registerCommand('forge.viewObjectManifest', async (object?: IObject) => {
		await mdc.viewObjectManifest(object, context);
	});
	vscode.commands.registerCommand('forge.deleteObjectManifest', async (object?: IObject) => {
		await mdc.deleteObjectManifest(object, context);
		simpleStorageDataProvider.refresh(object);
	});
	vscode.commands.registerCommand('forge.viewObjectThumbnail', async (object?: IObject) => {
		await mdc.viewObjectThumbnail(object, context);
	});
	vscode.commands.registerCommand('forge.downloadDerivative', async (object?: IObject) => {
		await mdc.downloadDerivativeSVF(object, context);
	});
	vscode.commands.registerCommand('forge.downloadDerivativeGltf', async (object?: IObject) => {
		await mdc.downloadDerivativeGLTF(object, context);
	});

	// Setup design automation view
	let designAutomationDataProvider = new dap.DesignAutomationDataProvider(context, env.clientId);
	let designAutomationView = vscode.window.createTreeView('forgeDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.extensionContext.subscriptions.push(designAutomationView);

	// Setup design automation commands
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

	// Setup webhooks view
	let webhooksDataProvider = new WebhooksDataProvider(context);
	let webhooksView = vscode.window.createTreeView('forgeWebhooksView', { treeDataProvider: webhooksDataProvider });
	context.extensionContext.subscriptions.push(webhooksView);

	// Setup webhooks commands
	vscode.commands.registerCommand('forge.createWebhook', async (event: IWebhookEvent) => {
		// TODO: create webhooks from command palette
		await createWebhook(event, context, function() {
			webhooksDataProvider.refresh(event);
		});
	});
	vscode.commands.registerCommand('forge.viewWebhookDetails', async (webhook: IWebhook) => {
		// TODO: view webhook details from command palette
		await viewWebhookDetails(webhook, context);
	});
	vscode.commands.registerCommand('forge.deleteWebhook', async (webhook: IWebhook) => {
		// TODO: delete webhooks from command palette
		await deleteWebhook(webhook, context);
		webhooksDataProvider.refresh();
	});

	// Setup rest
	function updateEnvironmentStatus(statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = 'Forge Env: ' + env.title;
		statusBarItem.command = 'forge.switchEnvironment';
		statusBarItem.show();
	}
	const envStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.extensionContext.subscriptions.push(envStatusBarItem);
	updateEnvironmentStatus(envStatusBarItem);

	vscode.commands.registerCommand('forge.switchEnvironment', async () => {
		const environments = getEnvironments();
		const name = await vscode.window.showQuickPick(environments.map(env => env.title), { placeHolder: 'Select Forge environment' });
		if (!name) {
			return;
		}
		env = environments.find(environment => environment.title === name) as IEnvironment;
		const auth = { client_id: env.clientId, client_secret: env.clientSecret };
		context.credentials = auth;
		context.dataManagementClient.reset(auth, undefined, env.region as Region);
		context.designAutomationClient.reset(auth, undefined, env.region as Region);
		context.modelDerivativeClient.reset(auth, undefined, env.region as Region);
		context.webhookClient.reset(auth, undefined, env.region as Region);
		context.authenticationClient = new AuthenticationClient(env.clientId, env.clientSecret);
		simpleStorageDataProvider.refresh();
		designAutomationDataProvider.refresh();
		updateEnvironmentStatus(envStatusBarItem);
	});
}

export function deactivate() { }
