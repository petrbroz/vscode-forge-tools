import * as vscode from 'vscode';
import { DataManagementClient } from 'forge-nodejs-utils';

import { SimpleStorageDataProvider } from './SimpleStorageDataProvider';

export function activate(context: vscode.ExtensionContext) {
	const ForgeClientID = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientId');
	const ForgeClientSecret = vscode.workspace.getConfiguration().get<string>('autodesk.forge.clientSecret');
	if (!ForgeClientID || !ForgeClientSecret) {
		vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings and reload the editor.');
		return;
	}

	console.log('Extension "vscode-forge-tools" has been loaded.');

	let dataManagementClient = new DataManagementClient({ client_id: ForgeClientID, client_secret: ForgeClientSecret });
	let simpleStorageDataProvider = new SimpleStorageDataProvider(dataManagementClient);
	let dataManagementView = vscode.window.createTreeView('forgeDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.subscriptions.push(dataManagementView);
}

// this method is called when your extension is deactivated
export function deactivate() {}