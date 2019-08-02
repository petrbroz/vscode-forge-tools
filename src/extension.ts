import * as vscode from 'vscode';
import {
	AuthenticationClient,
	IBucket,
	IObject,
	DataManagementClient,
	ModelDerivativeClient,
	DesignAutomationClient
} from 'forge-server-utils';
import * as dataManagementProviders from './providers/data-management';
import * as designAutomationProviders from './providers/design-automation';
import * as dataManagementCommands from './commands/data-management';
import * as modelDerivativeCommands from './commands/model-derivative';
import * as designAutomationCommands from './commands/design-automation';
import { Region } from 'forge-server-utils/dist/common';
import { TemplateEngine, IContext } from './common';

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
		authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret),
		dataManagementClient: new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		modelDerivativeClient: new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		designAutomationClient: new DesignAutomationClient({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region),
		templateEngine: new TemplateEngine(_context)
	};

	// Setup data management view
	let simpleStorageDataProvider = new dataManagementProviders.SimpleStorageDataProvider(context);
	let dataManagementView = vscode.window.createTreeView('forgeDataManagementView', { treeDataProvider: simpleStorageDataProvider });
	context.extensionContext.subscriptions.push(dataManagementView);

	// Data management commands
	vscode.commands.registerCommand('forge.refreshBuckets', () => {
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createBucket', async () => {
		await dataManagementCommands.createBucket(context);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.viewBucketDetails', async (bucket?: IBucket) => {
		await dataManagementCommands.viewBucketDetails(bucket, context);
	});
	vscode.commands.registerCommand('forge.viewObjectDetails', async (object?: IObject) => {
		await dataManagementCommands.viewObjectDetails(object, context);
	});
	vscode.commands.registerCommand('forge.uploadObject', async (bucket?: IBucket) => {
		await dataManagementCommands.uploadObject(bucket, context);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.downloadObject', async (object?: IObject) => {
		await dataManagementCommands.downloadObject(object, context);
	});
	vscode.commands.registerCommand('forge.deleteObject', async (object?: IObject) => {
		await dataManagementCommands.deleteObject(object, context);
		simpleStorageDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.generateSignedUrl', async (object?: IObject) => {
		await dataManagementCommands.generateSignedUrl(object, context);
	});

	// Model derivative commands
	vscode.commands.registerCommand('forge.translateObject', async (object?: IObject) => {
		await modelDerivativeCommands.translateObject(object, context);
		simpleStorageDataProvider.refresh(object);
	});
	vscode.commands.registerCommand('forge.previewDerivative', async (derivative?: dataManagementProviders.IDerivative) => {
		await modelDerivativeCommands.previewDerivative(derivative, context);
	});
	vscode.commands.registerCommand('forge.viewDerivativeTree', async (derivative?: dataManagementProviders.IDerivative) => {
		await modelDerivativeCommands.viewDerivativeTree(derivative, context);
	});
	vscode.commands.registerCommand('forge.viewDerivativeProps', async (derivative?: dataManagementProviders.IDerivative) => {
		await modelDerivativeCommands.viewDerivativeProps(derivative, context);
	});
	vscode.commands.registerCommand('forge.viewObjectManifest', async (object?: IObject) => {
		await modelDerivativeCommands.viewObjectManifest(object, context);
	});

	// Setup design automation view
	let designAutomationDataProvider = new designAutomationProviders.DesignAutomationDataProvider(context, env.clientId);
	let designAutomationView = vscode.window.createTreeView('forgeDesignAutomationView', { treeDataProvider: designAutomationDataProvider });
	context.extensionContext.subscriptions.push(designAutomationView);

	// Setup design automation commands
	vscode.commands.registerCommand('forge.viewAppBundleDetails', async (entry?: designAutomationProviders.IAppBundleAliasEntry | designAutomationProviders.ISharedAppBundleEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`;
		await designAutomationCommands.viewAppBundleDetails(id, context);
	});
	vscode.commands.registerCommand('forge.viewAppBundleVersionDetails', async (entry?: designAutomationProviders.IAppBundleVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.viewAppBundleDetails({ name: entry.appbundle, version: entry.version }, context);
	});
	vscode.commands.registerCommand('forge.deleteAppBundle', async (entry?: designAutomationProviders.IAppBundleEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteAppBundle(entry.appbundle, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.deleteAppBundleAlias', async (entry?: designAutomationProviders.IAppBundleAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteAppBundleAlias(entry.appbundle, entry.alias, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createAppBundleAlias', async (entry?: designAutomationProviders.IAppBundleAliasesEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.createAppBundleAlias(entry.appbundle, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.updateAppBundleAlias', async (entry?: designAutomationProviders.IAppBundleAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.updateAppBundleAlias(entry.appbundle, entry.alias, context);
	});
	vscode.commands.registerCommand('forge.deleteAppBundleVersion', async (entry?: designAutomationProviders.IAppBundleVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteAppBundleVersion(entry.appbundle, entry.version, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.viewActivityDetails', async (entry?: designAutomationProviders.IActivityAliasEntry | designAutomationProviders.ISharedActivityEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
		await designAutomationCommands.viewActivityDetails(id, context);
	});
	vscode.commands.registerCommand('forge.viewActivityVersionDetails', async (entry?: designAutomationProviders.IActivityVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.viewActivityDetails({ name: entry.activity, version: entry.version }, context);
	});
	vscode.commands.registerCommand('forge.deleteActivity', async (entry?: designAutomationProviders.IActivityEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteActivity(entry.activity, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.deleteActivityAlias', async (entry?: designAutomationProviders.IActivityAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteActivityAlias(entry.activity, entry.alias, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.createActivityAlias', async (entry?: designAutomationProviders.IActivityAliasesEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.createActivityAlias(entry.activity, context);
		designAutomationDataProvider.refresh();
	});
	vscode.commands.registerCommand('forge.updateActivityAlias', async (entry?: designAutomationProviders.IActivityAliasEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.updateActivityAlias(entry.activity, entry.alias, context);
	});
	vscode.commands.registerCommand('forge.deleteActivityVersion', async (entry?: designAutomationProviders.IActivityVersionEntry) => {
		if (!entry) {
			vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
			return;
		}
		await designAutomationCommands.deleteActivityVersion(entry.activity, entry.version, context);
		designAutomationDataProvider.refresh();
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
		context.dataManagementClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		context.designAutomationClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		context.modelDerivativeClient.reset({ client_id: env.clientId, client_secret: env.clientSecret }, undefined, env.region as Region);
		simpleStorageDataProvider.refresh();
		designAutomationDataProvider.refresh();
		updateEnvironmentStatus(envStatusBarItem);
	});
}

export function deactivate() { }
