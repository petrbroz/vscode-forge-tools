import * as fs from 'fs';
import * as vscode from 'vscode';
import axios from 'axios';
import { IContext, promptAppBundleFullID, promptEngine, showErrorMessage } from '../common';
import { IAppBundleUploadParams, IActivityDetail, IActivityParam, DesignAutomationID, IWorkItemParam, ICodeOnEngineStringSetting, ICodeOnEngineUrlSetting } from 'forge-server-utils';
import { withProgress, createWebViewPanel } from '../common';
import { ICreateActivityProps } from '../webviews/create-activity';

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

async function findAvailableEngines(context: IContext, progressTitle: string) {
	const availableEngines = await withProgress(progressTitle, context.designAutomationClient.listEngines());

	return availableEngines.sort();
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
		const stream = fs.createReadStream(filepath);
		withProgress(`Uploading app bundle: ${filepath}`, context.designAutomationClient.uploadAppBundleArchive(details, stream));
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

		const appBundleDetail = await withProgress(`Getting app bundle details: ${id}`, typeof(id) === 'string'
			? context.designAutomationClient.getAppBundle(id)
			: context.designAutomationClient.getAppBundleVersion((<INameAndVersion>id).name, (<INameAndVersion>id).version)
		);
		createWebViewPanel(context, 'appbundle-details.js', 'appbundle-details', `App Bundle Details: ${appBundleDetail.id}`, { detail: appBundleDetail });
	} catch (err) {
		showErrorMessage('Could not access app bundle', err);
	}
}

export async function viewAppBundleDetailsJSON(id: FullyQualifiedID | INameAndVersion | undefined, context: IContext) {
	try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		const appBundleDetail = await withProgress(`Getting app bundle details: ${id}`, typeof(id) === 'string'
			? context.designAutomationClient.getAppBundle(id)
			: context.designAutomationClient.getAppBundleVersion((<INameAndVersion>id).name, (<INameAndVersion>id).version)
		);
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(appBundleDetail, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch (err) {
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

		// TODO: add a method to the SDK for retrieve a single alias info
		const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
		const aliases = await withProgress(`Getting app bundle alias details: ${id}`, context.designAutomationClient.listAppBundleAliases(daid.id));
		const alias = aliases.find(entry => entry.id === daid.alias);
		createWebViewPanel(context, 'alias-details.js', 'alias-details', `Alias Details: ${id}`, { detail: alias });
	} catch(err) {
		showErrorMessage('Could not access app bundle alias', err);
	}
}

export async function viewAppBundleAliasDetailsJSON(id: FullyQualifiedID | undefined, context: IContext) {
    try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		// TODO: add a method to the SDK for retrieve a single alias info
		const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
		const aliases = await withProgress(`Getting app bundle alias details: ${id}`, context.designAutomationClient.listAppBundleAliases(daid.id));
		const alias = aliases.find(entry => entry.id === daid.alias);
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(alias, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch(err) {
		showErrorMessage('Could not access app bundle alias', err);
	}
}

export async function viewActivityDetails(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		const activityDetail = await withProgress(`Getting activity details: ${id}`, typeof(id) === 'string' ? context.designAutomationClient.getActivity(id) : context.designAutomationClient.getActivityVersion(id.name, id.version));
		createWebViewPanel(context, 'activity-details.js', 'activity-details', `Activity Details: ${activityDetail.id}`, { detail: activityDetail });
	} catch(err) {
		showErrorMessage('Could not access activity', err);
	}
}

export async function viewActivityDetailsJSON(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		const activityDetail = await withProgress(`Getting activity details: ${id}`, typeof(id) === 'string' ? context.designAutomationClient.getActivity(id) : context.designAutomationClient.getActivityVersion(id.name, id.version));
		createWebViewPanel(context, 'activity-details.js', 'activity-details', `Activity Details: ${activityDetail.id}`, { detail: activityDetail });
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(activityDetail, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
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

		// TODO: add a method to the SDK for retrieve a single alias info
		const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
		const aliases = await withProgress(`Getting activity alias details: ${id}`, context.designAutomationClient.listActivityAliases(daid.id));
		const alias = aliases.find(entry => entry.id === daid.alias);
		createWebViewPanel(context, 'alias-details.js', 'alias-details', `Alias Details: ${id}`, { detail: alias });
	} catch(err) {
		showErrorMessage('Could not access activity alias', err);
	}
}

export async function viewActivityAliasDetailsJSON(id: FullyQualifiedID | undefined, context: IContext) {
    try {
		if (!id) {
			id = await promptAppBundleFullID(context);
			if (!id) {
				return;
			}
		}

		// TODO: add a method to the SDK for retrieve a single alias info
		const daid = DesignAutomationID.parse(id as FullyQualifiedID) as DesignAutomationID;
		const aliases = await withProgress(`Getting activity alias details: ${id}`, context.designAutomationClient.listActivityAliases(daid.id));
		const alias = aliases.find(entry => entry.id === daid.alias);
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(alias, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch(err) {
		showErrorMessage('Could not access activity alias', err);
	}
}

export async function createActivity(successCallback: (activity: IActivityDetail) => void, context: IContext) {
	try {
		let availableEngines = await findAvailableEngines(context, 'Collecting available engines for a new activity');
		let availableAppBundles = await withProgress(`Collecting available app bundles for new activity`, context.designAutomationClient.listAppBundles());
		availableAppBundles = availableAppBundles.filter((id: string) => !id.endsWith('$LATEST'));

		let panel = createWebViewPanel<ICreateActivityProps>(context, 'create-activity.js', 'create-activity', 'Create Activity', {
			options: {
				engines: availableEngines,
				appBundles: availableAppBundles
			}
		}, async message => {
			switch (message.command) {
				case 'create':
					try {
						const { id, description, engine, commands, parameters, settings, appBundles } = message.activity;
						const activity = await context.designAutomationClient.createActivity(
							id,
							engine,
							commands,
							appBundles,
							parameters,
							settings,
							description
						);
						panel.dispose();
						vscode.window.showInformationMessage(`Activity created: ${activity.id} (version ${activity.version})`);
						successCallback(activity);
					} catch(err) {
						showErrorMessage('Could not create activity', err);
					}
					break;
			}
		});
	} catch(err) {
		showErrorMessage('Could not create activity', err);
	}
}

export async function updateActivity(id: FullyQualifiedID | INameAndVersion, successCallback: (activity: IActivityDetail) => void, context: IContext) {
	try {
		let originalActivity: IActivityDetail = typeof(id) === 'string'
			? await context.designAutomationClient.getActivity(id)
			: await context.designAutomationClient.getActivityVersion(id.name, id.version);

		let availableEngines = await findAvailableEngines(context, 'Collecting available engines for activity');
		let availableAppBundles = await withProgress(`Collecting available app bundles for activity`, context.designAutomationClient.listAppBundles());
		availableAppBundles = availableAppBundles.filter((id: string) => !id.endsWith('$LATEST'));

		let panel = createWebViewPanel(context, 'update-activity.js', 'update-activity', `Update Activity: ${originalActivity.id}`, {
			activity: originalActivity,
			options: {
				engines: availableEngines,
				appBundles: availableAppBundles
			}
		}, async message => {
			switch (message.command) {
				case 'update':
					try {
						const { id, description, engine, commands, parameters, settings, appBundles } = message.activity;
						const activity = await context.designAutomationClient.updateActivity(id, engine, commands, appBundles, parameters, settings, description);
						panel.dispose();
						vscode.window.showInformationMessage(`Activity updated: ${activity.id} (version ${activity.version})`);
						successCallback(activity);
					} catch(err) {
						showErrorMessage('Could not update activity', err);
					}
					break;
			}
		});
	} catch(err) {
		showErrorMessage('Could not update activity', err);
	}
}

export async function deleteAppBundle(id: UnqualifiedID, context: IContext) {
	try {
		await withProgress(`Removing app bundle: ${id}`, context.designAutomationClient.deleteAppBundle(id));
		vscode.window.showInformationMessage(`App bundle removed`);
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
			canPickMany: false, placeHolder: 'Select app bundle version'
		});
		if (!appBundleVersion) {
			return;
        }
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await withProgress(`Creating app bundle alias: ${id}/${alias}`, context.designAutomationClient.createAppBundleAlias(id, alias, parseInt(appBundleVersion), receiver));
		vscode.window.showInformationMessage(`App bundle alias created`);
	} catch(err) {
		showErrorMessage('Could not create app bundle alias', err);
	}
}

export async function updateAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const appBundleVersions = await context.designAutomationClient.listAppBundleVersions(id);
		const appBundleVersion = await vscode.window.showQuickPick(appBundleVersions.map((v: number) => v.toString()), {
			canPickMany: false, placeHolder: 'Select app bundle version'
		});
		if (!appBundleVersion) {
			return;
        }
        const receiver = await vscode.window.showInputBox({ prompt: 'Enter receiver ID (optional)' });
		await withProgress(`Updating app bundle alias: ${id}/${alias}`, context.designAutomationClient.updateAppBundleAlias(id, alias, parseInt(appBundleVersion), receiver));
		vscode.window.showInformationMessage(`App bundle alias updated`);
	} catch(err) {
		showErrorMessage('Could not update app bundle alias', err);
	}
}

export async function deleteAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await withProgress(`Removing app bundle alias: ${id}/${alias}`, context.designAutomationClient.deleteAppBundleAlias(id, alias));
		vscode.window.showInformationMessage(`App bundle alias removed`);
	} catch(err) {
		showErrorMessage('Could not remove app bundle alias', err);
	}
}

export async function deleteAppBundleVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await withProgress(`Removing app bundle version: ${id}/${version}`, context.designAutomationClient.deleteAppBundleVersion(id, version));
		vscode.window.showInformationMessage(`App bundle version removed`);
	} catch(err) {
		showErrorMessage('Could not remove app bundle version', err);
	}
}

export async function deleteActivity(id: UnqualifiedID, context: IContext) {
	try {
		await withProgress(`Removing activity: ${id}`, context.designAutomationClient.deleteActivity(id));
		vscode.window.showInformationMessage(`Activity removed`);
	} catch(err) {
		showErrorMessage('Could not remove activity', err);
	}
}

export async function deleteActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await withProgress(`Removing activity alias: ${id}/${alias}`, context.designAutomationClient.deleteActivityAlias(id, alias));
		vscode.window.showInformationMessage(`Activity alias removed`);
	} catch(err) {
		showErrorMessage('Could not remove activity alias', err);
	}
}

export async function deleteActivityVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await withProgress(`Removing activity version: ${id}/${version}`, context.designAutomationClient.deleteActivityVersion(id, version));
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
		await withProgress(`Creating activity alias: ${id}/${alias}`, context.designAutomationClient.createActivityAlias(id, alias, parseInt(activityVersion), receiver))
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
		await withProgress(`Updating activity alias: ${id}/${alias}`, context.designAutomationClient.updateActivityAlias(id, alias, parseInt(activityVersion), receiver));
		vscode.window.showInformationMessage(`Activity alias updated`);
	} catch(err) {
		showErrorMessage('Could not update activity alias', err);
	}
}

export async function createWorkitem(id: FullyQualifiedID, context: IContext) {
	try {
		const activity = await withProgress(`Getting activity details: ${id}`, context.designAutomationClient.getActivity(id));
		if (activity) {
			let panel = createWebViewPanel(context, 'create-workitem.js', 'create-workitem', `Create Work Item: ${activity.id}`, { activity }, async message => {
				switch (message.command) {
					case 'create':
						try {
							const { parameters } = message;
							let workitem = await context.designAutomationClient.createWorkItem(id, parameters);
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
						// panel.dispose();
						break;
				}
			});
		}
	} catch(err) {
		showErrorMessage('Could not create workitem', err);
	}
}