import * as fs from 'fs';
import * as vscode from 'vscode';
import axios from 'axios';
import { IContext, promptAppBundleFullID, promptEngine, showErrorMessage } from '../common';
import { IAppBundleUploadParams, IActivityDetail, IActivityParam, DesignAutomationID, IWorkItemParam, ICodeOnEngineStringSetting, ICodeOnEngineUrlSetting } from 'forge-server-utils';

type FullyQualifiedID = string;
type UnqualifiedID = string;
interface INameAndVersion {
	name: string;
	version: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise(function(resolve, reject) {
        setTimeout(function() { resolve(); }, ms);
    });
}

interface SettingsSplitByType {
	strings: {[name: string]: ICodeOnEngineStringSetting};
	urls: {[name: string]: ICodeOnEngineUrlSetting};
}

function splitCodeOnEngineSettingsByType(settings: {[name: string]: (ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting)}) : SettingsSplitByType {
	let result: SettingsSplitByType = {
		strings: {},
		urls: {}
	};

	for (let settingName of Object.keys(settings)) {
		let setting: (ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting) = settings[settingName];

		if ((setting as ICodeOnEngineStringSetting).value) {
			result.strings[settingName] = setting as ICodeOnEngineStringSetting;
		} else if ((setting as ICodeOnEngineUrlSetting).url) {
			result.urls[settingName] = setting as ICodeOnEngineUrlSetting;
		}
	}
	return result;	
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
			details = await context.designAutomationClient.updateAppBundle(name, engine, undefined, description);
		} else {
			details = await context.designAutomationClient.createAppBundle(name, engine, undefined, description);
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
		showErrorMessage('Could not upload app bundle', err);
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
				{
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
			);
			panel.webview.html = context.templateEngine.render('appbundle-details', { bundle: appBundleDetail });
		});
	} catch(err) {
		showErrorMessage('Could not access app bundle', err);
	}
}

export async function viewAppBundleAliasDetails(id: FullyQualifiedID | undefined, context: IContext) {
    try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting alias details: ${id}`,
			cancellable: false
        }, async (progress, token) => {
            // TODO: add a method to the SDK for retrieve a single alias info
            const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
            const aliases = await context.designAutomationClient.listAppBundleAliases(daid.id);
            const alias = aliases.find(entry => entry.id === daid.alias);
			const panel = vscode.window.createWebviewPanel(
				'appbundle-alias-details',
				`Details: ${id}`,
				vscode.ViewColumn.One,
				{
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
			);
			panel.webview.html = context.templateEngine.render('alias-details', { alias });
		});
	} catch(err) {
		showErrorMessage('Could not access app bundle alias', err);
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
				{
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
			);
			const daid = DesignAutomationID.parse(activityDetail.id);
			let settingsSplitted = splitCodeOnEngineSettingsByType(activityDetail.settings || {});
			panel.webview.html = context.templateEngine.render('activity-details', {
				mode: 'read',
				id: (daid !== null) ? daid.id : activityDetail.id,
				description: (activityDetail as any).description, // TODO: add description to IActivityDetail
				version: activityDetail.version,
				engine: activityDetail.engine,
				commandLine: activityDetail.commandLine,
				parameters: activityDetail.parameters || {},
				settingsString: settingsSplitted.strings || {},
				settingsUrl: settingsSplitted.urls || {},
				appbundles: activityDetail.appbundles || []
			});
		});
	} catch(err) {
		showErrorMessage('Could not access activity', err);
	}
}

export async function viewActivityAliasDetails(id: FullyQualifiedID | undefined, context: IContext) {
    try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting alias details: ${id}`,
			cancellable: false
        }, async (progress, token) => {
            // TODO: add a method to the SDK for retrieve a single alias info
            const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
            const aliases = await context.designAutomationClient.listActivityAliases(daid.id);
            const alias = aliases.find(entry => entry.id === daid.alias);
			const panel = vscode.window.createWebviewPanel(
				'activity-alias-details',
				`Details: ${id}`,
				vscode.ViewColumn.One,
				{
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
			);
			panel.webview.html = context.templateEngine.render('alias-details', { alias });
		});
	} catch(err) {
		showErrorMessage('Could not access activity alias', err);
	}
}

export async function createActivity(successCallback: (activity: IActivityDetail) => void, context: IContext) {
	async function create(params: any, panel: vscode.WebviewPanel) {
		
		try {
			const activity = await context.designAutomationClient.createActivity(
				params.id,
				params.engine,
				params.commandLine,
				params.appBundles,
				params.parameters,
				params.settings,
				params.description
			);
			panel.dispose();
			vscode.window.showInformationMessage(`Activity created: ${activity.id} (version ${activity.version})`);
			successCallback(activity);
		} catch(err) {
			showErrorMessage('Could not create activity', err);
		}
	}

	try {
		let availableEngines: string[] = [];
		let availableAppBundles: string[] = [];

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Collecting available values for new activity`,
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
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
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
			settingsString: {
				'': {}
			},
			settingsUrl: {
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
		showErrorMessage('Could not create activity', err);
	}
}

export async function updateActivity(id: FullyQualifiedID | INameAndVersion, successCallback: (activity: IActivityDetail) => void, context: IContext) {
	async function update(params: any, panel: vscode.WebviewPanel) {
		
		try {
			const activity = await context.designAutomationClient.updateActivity(
				params.id,
				params.engine,
				params.commandLine,
				params.appBundles,
				params.parameters,
				params.settings,
				params.description
			);
			panel.dispose();
			vscode.window.showInformationMessage(`Activity updated: ${activity.id} (version ${activity.version})`);
			successCallback(activity);
		} catch(err) {
			showErrorMessage('Could not update activity', err);
		}
	}

	try {
		let availableEngines: string[] = [];
		let availableAppBundles: string[] = [];
		let originalActivity: IActivityDetail = typeof(id) === 'string'
			? await context.designAutomationClient.getActivity(id)
			: await context.designAutomationClient.getActivityVersion(id.name, id.version);

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Collecting available values for activity`,
			cancellable: false
		}, async (progress, token) => {
			availableEngines = await context.designAutomationClient.listEngines();
			availableAppBundles = await context.designAutomationClient.listAppBundles();
			availableAppBundles = availableAppBundles.filter((id: string) => !id.endsWith('$LATEST'));
		});

		const panel = vscode.window.createWebviewPanel(
			'update-activity',
			`Activity: ${originalActivity.id}`,
			vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
		);
		const daid = DesignAutomationID.parse(originalActivity.id) as DesignAutomationID;
		let settingsSplitted = splitCodeOnEngineSettingsByType(originalActivity.settings || {});
		panel.webview.html = context.templateEngine.render('activity-details', {
			mode: 'update',
			id: (daid !== null) ? daid.id : originalActivity.id,
			description: (originalActivity as any).description,
			version: originalActivity.version,
			engine: originalActivity.engine,
			commandLine: originalActivity.commandLine,
			parameters: originalActivity.parameters,
			settingsString: settingsSplitted.strings,
			settingsUrl: settingsSplitted.urls,
			appbundles: originalActivity.appbundles,
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
						update(message.activity, panel);
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
		showErrorMessage('Could not update activity', err);
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
		showErrorMessage('Could not remove app bundle', err);
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
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createAppBundleAlias(id, alias, parseInt(appBundleVersion), receiver);
		});
		vscode.window.showInformationMessage(`Appbundle alias created`);
	} catch(err) {
		showErrorMessage('Could not create app bundle alias', err);
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
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateAppBundleAlias(id, alias, parseInt(appBundleVersion), receiver);
		});
		vscode.window.showInformationMessage(`Appbundle alias updated`);
	} catch(err) {
		showErrorMessage('Could not update app bundle alias', err);
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
		showErrorMessage('Could not remove app bundle alias', err);
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
		showErrorMessage('Could not remove app bundle version', err);
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
		showErrorMessage('Could not remove activity', err);
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
		showErrorMessage('Could not remove activity alias', err);
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
		showErrorMessage(`Could not remove activity version`, err);
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
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createActivityAlias(id, alias, parseInt(activityVersion), receiver);
		});
		vscode.window.showInformationMessage(`Activity alias created`);
	} catch(err) {
		showErrorMessage('Could not create activity alias', err);
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
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateActivityAlias(id, alias, parseInt(activityVersion), receiver);
		});
		vscode.window.showInformationMessage(`Activity alias updated`);
	} catch(err) {
		showErrorMessage('Could not update activity alias', err);
	}
}

export async function createWorkitem(id: FullyQualifiedID, context: IContext) {
	async function run(params: { [key: string]: IWorkItemParam }) {
		try {
			let workitem = await context.designAutomationClient.createWorkItem(id, params);
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Processing workitem: ${workitem.id}`,
				cancellable: false
			}, async (progress, token) => {
				while (workitem.status === 'inprogress' || workitem.status === 'pending') {
					await sleep(5000);
					workitem = await context.designAutomationClient.getWorkItem(workitem.id);
					progress.report({ message: workitem.status });
				}
			});

			let action: string | undefined;
			if (workitem.status === 'success') {
				action = await vscode.window.showInformationMessage(`Workitem succeeded`, 'View Report');
			} else {
				action = await vscode.window.showErrorMessage(`Workitem failed`, 'View Report');
			}
			if (action === 'View Report') {
				const resp = await axios.get(workitem.reportUrl);
				const doc = await vscode.workspace.openTextDocument({ content: resp.data });
				vscode.window.showTextDocument(doc);
			}
		} catch(err) {
			showErrorMessage('Could not start workitem', err);
		}
	}

	try {
		let activity: IActivityDetail | undefined;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting activity details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			activity = await context.designAutomationClient.getActivity(id);
		});

		if (activity) {
			const panel = vscode.window.createWebviewPanel(
				'workitem',
				`Workitem: ${activity.id}`,
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);
			panel.webview.html = context.templateEngine.render('workitem', { activity });
			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'start':
							run(message.parameters);
							//panel.dispose();
							break;
						case 'cancel':
							panel.dispose();
							break;
					}
				},
				undefined,
				context.extensionContext.subscriptions
			);
		}
	} catch(err) {
		showErrorMessage('Could not create workitem', err);
	}
}
