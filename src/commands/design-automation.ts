import * as fs from 'fs';
import * as vscode from 'vscode';
import { IContext, promptAppBundleFullID, promptEngine } from '../common';
import { IAppBundleUploadParams, IActivityDetail, IActivityParam, DesignAutomationID } from 'forge-server-utils';

type FullyQualifiedID = string;
type UnqualifiedID = string;
interface INameAndVersion {
	name: string;
	version: number;
}

export async function uploadAppBundle(name: string | undefined, context: IContext) {
	try {
		let exists = !!name;
		if (!name) {
			name = await vscode.window.showInputBox({ prompt: 'Enter app bundle name', value: '' });
			if (!name) {
				return;
			}
		}
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, openLabel: 'Upload zip' });
		if (!uris) {
			return;
		}
		const engine = await promptEngine(context);
		if (!engine) {
			return;
		}
		const description = await vscode.window.showInputBox({ prompt: 'Enter app bundle description', value: '' });
		if (typeof description === 'undefined') {
			return;
		}

		const filepath = uris[0].fsPath;
		let details: IAppBundleUploadParams;
		if (exists) {
			details = await context.designAutomationClient.updateAppBundle(name, engine, description);
		} else {
			details = await context.designAutomationClient.createAppBundle(name, engine, description);
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Uploading app bundle: ${filepath}`,
			cancellable: false
		}, async (progress, token) => {
			const stream = fs.createReadStream(filepath);
			await context.designAutomationClient.uploadAppBundleArchive(details, stream);
		});
        vscode.window.showInformationMessage(`App bundle uploaded: ${filepath}`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not upload app bundle: ${JSON.stringify(err.message)}`);
	}
}

export async function viewAppBundleDetails(id: FullyQualifiedID | INameAndVersion | undefined, context: IContext) {
	try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting appbundle details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const appBundleDetail = typeof(id) === 'string'
				? await context.designAutomationClient.getAppBundle(id)
				: await context.designAutomationClient.getAppBundleVersion((<INameAndVersion>id).name, (<INameAndVersion>id).version);
			const panel = vscode.window.createWebviewPanel(
				'appbundle-details',
				`Details: ${appBundleDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			panel.webview.html = context.templateEngine.render('appbundle-details', { bundle: appBundleDetail });
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function viewActivityDetails(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting activity details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const activityDetail = typeof(id) === 'string'
				? await context.designAutomationClient.getActivity(id)
				: await context.designAutomationClient.getActivityVersion(id.name, id.version);
			const panel = vscode.window.createWebviewPanel(
				'activity-details',
				`Details: ${activityDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			panel.webview.html = context.templateEngine.render('activity-details', {
				mode: 'read',
				id: activityDetail.id,
				description: (activityDetail as any).description, // TODO: add description to IActivityDetail
				version: activityDetail.version,
				engine: activityDetail.engine,
				commandLine: activityDetail.commandLine,
				parameters: activityDetail.parameters,
				appbundles: activityDetail.appbundles
			});
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access activity: ${JSON.stringify(err.message)}`);
	}
}

export async function createActivity(successCallback: (activity: IActivityDetail) => void, context: IContext) {
	async function create(params: any, panel: vscode.WebviewPanel) {
		if (params.appBundles.length === 0) {
			vscode.window.showErrorMessage('At least one app bundle must be provided.');
			return;
		} else if (params.appBundles.length > 1) {
			// TODO: add support for creating activities with multiple app bundles
			vscode.window.showWarningMessage('Currently it is only possible to create activities with one app bundle. Additional bundles will be ignored.');
		}

		const appBundleID = DesignAutomationID.parse(params.appBundles[0]) as DesignAutomationID;
		const inputs: IActivityParam[] = [];
		const outputs: IActivityParam[] = [];
		for (const name of Object.keys(params.parameters)) {
			const param = params.parameters[name];
			switch (param.verb) {
				case 'get':
					inputs.push({
						name,
						verb: param.verb,
						description: param.description,
						localName: param.localName,
						// TODO: support 'ondemand', 'required', and 'zip' fields
					});
					break;
				case 'put':
					outputs.push({
						name,
						verb: param.verb,
						description: param.description,
						localName: param.localName,
						// TODO: support 'ondemand', 'required', and 'zip' fields
					});
					break;
			}
		}

		try {
			// TODO: currently the forge-server-utils library builts the command line
			// based on selected engine; add support for custom command lines as well
			const activity = await context.designAutomationClient.createActivity(
				params.id,
				params.description,
				appBundleID.id,
				appBundleID.alias,
				params.engine,
				inputs,
				outputs
			);
			panel.dispose();
			vscode.window.showInformationMessage(`Activity created: ${activity.id} (version ${activity.version})`);
			successCallback(activity);
		} catch(err) {
			vscode.window.showErrorMessage(`Could not create activity: ${JSON.stringify(err.message)}`);
		}
	}

	try {
		let availableEngines: string[] = [];
		let availableAppBundles: string[] = [];

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Collecting available valus for new activity`,
			cancellable: false
		}, async (progress, token) => {
			availableEngines = await context.designAutomationClient.listEngines();
			availableAppBundles = await context.designAutomationClient.listAppBundles();
			availableAppBundles = availableAppBundles.filter((id: string) => !id.endsWith('$LATEST'));
		});

		const panel = vscode.window.createWebviewPanel(
			'new-activity',
			`New Activity`,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('activity-details', {
			mode: 'create',
			id: '',
			description: '',
			version: '',
			engine: '',
			commandLine: [''],
			parameters: {
				'': {}
			},
			appbundles: [availableAppBundles[0]],
			options: {
				engines: availableEngines,
				appBundles: availableAppBundles
			}
		});
		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'create':
						create(message.activity, panel);
						break;
					case 'cancel':
						panel.dispose();
						break;
				}
			},
			undefined,
			context.extensionContext.subscriptions
		);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundle(id: UnqualifiedID, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing appbundle: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundle(id);
		});
		vscode.window.showInformationMessage(`Appbundle removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function createAppBundleAlias(id: UnqualifiedID, context: IContext) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const appBundleVersions = await context.designAutomationClient.listAppBundleVersions(id);
		const appBundleVersion = await vscode.window.showQuickPick(appBundleVersions.map((v: number) => v.toString()), {
			canPickMany: false, placeHolder: 'Select appbundle version'
		});
		if (!appBundleVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const appBundleVersions = await context.designAutomationClient.listAppBundleVersions(id);
		const appBundleVersion = await vscode.window.showQuickPick(appBundleVersions.map((v: number) => v.toString()), {
			canPickMany: false, placeHolder: 'Select appbundle version'
		});
		if (!appBundleVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundleAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Appbundle alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundleVersion(id, version);
		});
		vscode.window.showInformationMessage(`Appbundle version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle version: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivity(id: UnqualifiedID, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivity(id);
		});
		vscode.window.showInformationMessage(`Activity removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivityAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Activity alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivityVersion(id, version);
		});
		vscode.window.showInformationMessage(`Activity version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity version: ${JSON.stringify(err.message)}`);
	}
}

export async function createActivityAlias(id: UnqualifiedID, context: IContext) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const activityVersions = await context.designAutomationClient.listActivityVersions(id);
		const activityVersion = await vscode.window.showQuickPick(activityVersions.map((v: number) => v.toString()), {
			canPickMany: false, placeHolder: 'Select activity version'
		});
		if (!activityVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const activityVersions = await context.designAutomationClient.listActivityVersions(id);
		const activityVersion = await vscode.window.showQuickPick(activityVersions.map((v: number) => v.toString()), {
			canPickMany: false, placeHolder: 'Select activity version'
		});
		if (!activityVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update activity alias: ${JSON.stringify(err.message)}`);
	}
}
