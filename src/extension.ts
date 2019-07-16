import * as vscode from 'vscode';
import {
	AuthenticationClient,
	IBucket,
	IObject,
	DataManagementClient,
	ModelDerivativeClient,
	DesignAutomationClient
} from 'forge-nodejs-utils';

import {
	SimpleStorageDataProvider,
	DesignAutomationDataProvider,
	IDerivative,
	IAppBundleAliasEntry,
	IActivityAliasEntry,
	IAppBundleVersionEntry,
	IActivityVersionEntry,
	IAppBundleEntry,
	IActivityEntry,
	ISharedActivityEntry,
	ISharedAppBundleEntry,
	IActivityAliasesEntry,
	IAppBundleAliasesEntry
} from './providers';
import {
	createBucket,
	uploadObject,
	downloadObject,
	viewObjectDetails,
	viewAppBundleDetails,
	viewActivityDetails,
	previewObject,
	viewBucketDetails,
	deleteAppBundle,
	deleteAppBundleAlias,
	deleteAppBundleVersion,
	deleteActivity,
	deleteActivityAlias,
	deleteActivityVersion,
	deleteObject,
	createActivityAlias,
	createAppBundleAlias,
	updateActivityAlias,
	updateAppBundleAlias
} from './commands';
import { Region } from 'forge-nodejs-utils/dist/common';

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

export function activate(context: vscode.ExtensionContext) {
	const environments = getEnvironments();
	if (environments.length === 0 || !environments[0].clientId || !environments[0].clientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}
	let env = environments[0];

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let authClient = new AuthenticationClient(env.clientId, env.clientSecret);
	let dataManagementClient = new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
	let modelDerivativeClient = new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
	let designAutomationClient = new DesignAutomationClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);

	// Setup data management view
	let simpleStorageDataProvider = new SimpleStorageDataProvider(dataManagementClient, modelDerivativeClient);
	let dataManagementView = vscode.window.createTreeView('forgeDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.subscriptions.push(dataManagementView);

	// Setup data management commands
	vscode.commands.registerCommand('forge.refreshBuckets', () => {
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createBucket', async () => {
		await createBucket(dataManagementClient);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.viewBucketDetails', async (bucket?: IBucket) => {
		if (!bucket) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewBucketDetails(bucket.bucketKey, context, dataManagementClient);
	});
	vscode.commands.registerCommand('forge.uploadObject', async (bucket?: IBucket) => {
		if (!bucket) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await uploadObject(bucket, dataManagementClient);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.downloadObject', async (object?: IObject) => {
		if (!object) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await downloadObject(object.bucketKey, object.objectKey, dataManagementClient);
	});
	vscode.commands.registerCommand('forge.previewObject', async (derivative?: IDerivative) => {
		if (!derivative) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await previewObject(derivative, context, authClient, modelDerivativeClient);
	});
	vscode.commands.registerCommand('forge.viewObjectDetails', async (object?: IObject) => {
		if (!object) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewObjectDetails(object, context);
	});
	vscode.commands.registerCommand('forge.deleteObject', async (object?: IObject) => {
		if (!object) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteObject(object, context, dataManagementClient);
		simpleStorageDataProvider.refresh();
	});

	// Setup design automation view
	let designAutomationDataProvider = new DesignAutomationDataProvider(designAutomationClient, env.clientId);
	let designAutomationView = vscode.window.createTreeView('forgeDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.subscriptions.push(designAutomationView);

	// Setup design automation commands
	vscode.commands.registerCommand('forge.viewAppBundleDetails', async (entry?: IAppBundleAliasEntry | ISharedAppBundleEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`;
		await viewAppBundleDetails(id, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.viewAppBundleVersionDetails', async (entry?: IAppBundleVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewAppBundleDetails({ name: entry.appbundle, version: entry.version }, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.deleteAppBundle', async (entry?: IAppBundleEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteAppBundle(entry.appbundle, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.deleteAppBundleAlias', async (entry?: IAppBundleAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteAppBundleAlias(entry.appbundle, entry.alias, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createAppBundleAlias', async (entry?: IAppBundleAliasesEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await createAppBundleAlias(entry.appbundle, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.updateAppBundleAlias', async (entry?: IAppBundleAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await updateAppBundleAlias(entry.appbundle, entry.alias, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.deleteAppBundleVersion', async (entry?: IAppBundleVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteAppBundleVersion(entry.appbundle, entry.version, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.viewActivityDetails', async (entry?: IActivityAliasEntry | ISharedActivityEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
		await viewActivityDetails(id, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.viewActivityVersionDetails', async (entry?: IActivityVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewActivityDetails({ name: entry.activity, version: entry.version }, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.deleteActivity', async (entry?: IActivityEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteActivity(entry.activity, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.deleteActivityAlias', async (entry?: IActivityAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteActivityAlias(entry.activity, entry.alias, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createActivityAlias', async (entry?: IActivityAliasesEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await createActivityAlias(entry.activity, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.updateActivityAlias', async (entry?: IActivityAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await updateActivityAlias(entry.activity, entry.alias, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.deleteActivityVersion', async (entry?: IActivityVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await deleteActivityVersion(entry.activity, entry.version, context, designAutomationClient);
		designAutomationDataProvider.refresh();
	});

	// Setup rest
	function updateEnvironmentStatus(statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = 'Forge Env: ' + env.title;
		statusBarItem.command = 'forge.switchEnvironment';
		statusBarItem.show();
	}
	const envStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.subscriptions.push(envStatusBarItem);
	updateEnvironmentStatus(envStatusBarItem);

	vscode.commands.registerCommand('forge.switchEnvironment', async () => {
		const environments = getEnvironments();
		const name = await vscode.window.showQuickPick(environments.map(env => env.title), { placeHolder: 'Select Forge environment' });
		if (!name) {
			return;
		}
		env = environments.find(environment => environment.title === name) as IEnvironment;
		dataManagementClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		designAutomationClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		modelDerivativeClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		simpleStorageDataProvider.refresh();
		designAutomationDataProvider.refresh();
		updateEnvironmentStatus(envStatusBarItem);
	});
}

export function deactivate() { }
