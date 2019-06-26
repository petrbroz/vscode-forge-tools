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

export function activate(context: vscode.ExtensionContext) {
	const ForgeClientID = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientId');
	const ForgeClientSecret = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientSecret');
	if (!ForgeClientID || !ForgeClientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}
	const ForgeRegion = vscode.workspace.getConfiguration().get<string>('autodesk.forge.dataRegion');

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let authClient = new AuthenticationClient(ForgeClientID, ForgeClientSecret);
	let dataManagementClient = new DataManagementClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret }, undefined, ForgeRegion as Region);
	let modelDerivativeClient = new ModelDerivativeClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret }, undefined, ForgeRegion as Region);
	let designAutomationClient = new DesignAutomationClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret }, undefined, ForgeRegion as Region);

	// Setup data management view
	let simpleStorageDataProvider = new SimpleStorageDataProvider(dataManagementClient);
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
	vscode.commands.registerCommand('forge.previewObject', async (object?: IObject) => {
		if (!object) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await previewObject(object, context, authClient, modelDerivativeClient);
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
	let designAutomationDataProvider = new DesignAutomationDataProvider(designAutomationClient, ForgeClientID);
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
}

export function deactivate() { }