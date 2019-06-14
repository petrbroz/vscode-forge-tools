import * as vscode from 'vscode';
import { DataManagementClient, IBucket, IObject } from 'forge-nodejs-utils';

import { SimpleStorageDataProvider } from './providers';
import { createBucket, uploadObject, downloadObject } from './commands';

export function activate(context: vscode.ExtensionContext) {
	const ForgeClientID = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientId');
	const ForgeClientSecret = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientSecret');
	if (!ForgeClientID || !ForgeClientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let dataManagementClient = new DataManagementClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret });

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
}

export function deactivate() { }