import * as vscode from 'vscode';
import {
	AuthenticationClient,
	IBucket,
	IObject,
	DataManagementClient,
	ModelDerivativeClient,
	DesignAutomationClient
} from 'forge-nodejs-utils';

import { SimpleStorageDataProvider, DesignAutomationDataProvider, IAppBundleEntry, IActivityEntry } from './providers';
import {
	createBucket,
	uploadObject,
	downloadObject,
	viewObjectDetails,
	viewAppBundleDetails,
	viewActivityDetails,
	previewObject,
	viewBucketDetails
} from './commands';

export function activate(context: vscode.ExtensionContext) {
	const ForgeClientID = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientId');
	const ForgeClientSecret = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientSecret');
	if (!ForgeClientID || !ForgeClientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let authClient = new AuthenticationClient(ForgeClientID, ForgeClientSecret);
	let dataManagementClient = new DataManagementClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret });
	let modelDerivativeClient = new ModelDerivativeClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret });
	let designAutomationClient = new DesignAutomationClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret });

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

	// Setup design automation view
	let designAutomationDataProvider = new DesignAutomationDataProvider(designAutomationClient, ForgeClientID);
	let designAutomationView = vscode.window.createTreeView('forgeDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.subscriptions.push(designAutomationView);

	// Setup design automation commands
	vscode.commands.registerCommand('forge.viewAppBundleDetails', async (bundle?: IAppBundleEntry) => {
		if (!bundle) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewAppBundleDetails(bundle.id, context, designAutomationClient);
	});
	vscode.commands.registerCommand('forge.viewActivityDetails', async (activity?: IActivityEntry) => {
		if (!activity) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await viewActivityDetails(activity.id, context, designAutomationClient);
	});
}

export function deactivate() { }