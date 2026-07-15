import * as fs from 'fs';
import * as vscode from 'vscode';
import axios from 'axios';
import { IContext, promptAppBundleFullID, promptEngine, showErrorMessage } from '../common';
import { IAppBundleUploadParams, IActivityDetail, DesignAutomationID } from 'aps-sdk-node';
import { withProgress, createWebViewPanel } from '../common';
import { ICreateActivityProps } from '../webviews/create-activity';
import { IAppBundleEntry, IAppBundleAliasEntry, ISharedAppBundleEntry, IAppBundleVersionEntry, IAppBundleAliasesEntry, IActivityAliasEntry, ISharedActivityEntry, IActivityVersionEntry, IActivityEntry, IActivityAliasesEntry } from '../interfaces/design-automation';

type FullyQualifiedID = string;
type UnqualifiedID = string;
interface INameAndVersion {
	name: string;
	version: number;
}

export class DesignAutomationCommands {
	constructor(protected context: IContext, protected refresh: () => void) {
	}

	registerCommands(): vscode.Disposable[] {
		return [
			vscode.commands.registerCommand('aps.da.refreshDesignAutomationTree', this.refreshDesignAutomationTree.bind(this)),
			vscode.commands.registerCommand('aps.da.createAppBundle', this.createAppBundle.bind(this)),
			vscode.commands.registerCommand('aps.da.updateAppBundle', this.updateAppBundle.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleDetails', this.viewAppBundleDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleDetailsJSON', this.viewAppBundleDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleAliasDetails', this.viewAppBundleAliasDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleAliasDetailsJSON', this.viewAppBundleAliasDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleVersionDetails', this.viewAppBundleVersionDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewAppBundleVersionDetailsJSON', this.viewAppBundleVersionDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteAppBundle', this.deleteAppBundle.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteAppBundleAlias', this.deleteAppBundleAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.createAppBundleAlias', this.createAppBundleAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.updateAppBundleAlias', this.updateAppBundleAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteAppBundleVersion', this.deleteAppBundleVersion.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityDetails', this.viewActivityDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityDetailsJSON', this.viewActivityDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityAliasDetails', this.viewActivityAliasDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityAliasDetailsJSON', this.viewActivityAliasDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityVersionDetails', this.viewActivityVersionDetails.bind(this)),
			vscode.commands.registerCommand('aps.da.viewActivityVersionDetailsJSON', this.viewActivityVersionDetailsJSON.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteActivity', this.deleteActivity.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteActivityAlias', this.deleteActivityAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.createActivity', this.createActivity.bind(this)),
			vscode.commands.registerCommand('aps.da.updateActivity', this.updateActivity.bind(this)),
			vscode.commands.registerCommand('aps.da.createActivityAlias', this.createActivityAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.updateActivityAlias', this.updateActivityAlias.bind(this)),
			vscode.commands.registerCommand('aps.da.deleteActivityVersion', this.deleteActivityVersion.bind(this)),
			vscode.commands.registerCommand('aps.da.createWorkItem', this.createWorkItem.bind(this)),
		];
	}

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async refreshDesignAutomationTree() {
        this.refresh();
    }

	async createAppBundle() {
        await uploadAppBundle(undefined, this.context);
        this.refresh();
	}

	async updateAppBundle(entry?: IAppBundleEntry) {
		entry = this.ensureInput(entry);
        await uploadAppBundle(entry.appbundle, this.context);
        this.refresh();
	}

	async viewAppBundleDetails(entry?: IAppBundleAliasEntry | ISharedAppBundleEntry) {
        if (entry) {
            await viewAppBundleDetails('fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`, this.context);
        } else {
            await viewAppBundleDetails(undefined, this.context);
        }
	}

	async viewAppBundleDetailsJSON(entry?: IAppBundleAliasEntry | ISharedAppBundleEntry) {
        if (entry) {
            await viewAppBundleDetailsJSON('fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`, this.context);
        } else {
            await viewAppBundleDetailsJSON(undefined, this.context);
        }
	}

	async viewAppBundleAliasDetails(entry?: IAppBundleAliasEntry) {
		await viewAppBundleAliasDetails(entry ? `${entry.client}.${entry.appbundle}+${entry.alias}` : undefined, this.context);
	}

	async viewAppBundleAliasDetailsJSON(entry?: IAppBundleAliasEntry) {
		await viewAppBundleAliasDetailsJSON(entry ? `${entry.client}.${entry.appbundle}+${entry.alias}` : undefined, this.context);
	}

	async viewAppBundleVersionDetails(entry?: IAppBundleVersionEntry) {
        entry = this.ensureInput(entry);
        await viewAppBundleDetails({ name: entry.appbundle, version: entry.version }, this.context);
	}

	async viewAppBundleVersionDetailsJSON(entry?: IAppBundleVersionEntry) {
        entry = this.ensureInput(entry);
        await viewAppBundleDetailsJSON({ name: entry.appbundle, version: entry.version }, this.context);
	}

	async deleteAppBundle(entry?: IAppBundleEntry) {
        entry = this.ensureInput(entry);
        await deleteAppBundle(entry.appbundle, this.context);
        this.refresh();
	}

	async deleteAppBundleAlias(entry?: IAppBundleAliasEntry) {
        entry = this.ensureInput(entry);
        await deleteAppBundleAlias(entry.appbundle, entry.alias, this.context);
        this.refresh();
	}

	async createAppBundleAlias(entry?: IAppBundleAliasesEntry) {
        entry = this.ensureInput(entry);
        await createAppBundleAlias(entry.appbundle, this.context);
        this.refresh();
	}

	async updateAppBundleAlias(entry?: IAppBundleAliasEntry) {
        entry = this.ensureInput(entry);
        await updateAppBundleAlias(entry.appbundle, entry.alias, this.context);
	}

	async deleteAppBundleVersion(entry?: IAppBundleVersionEntry) {
        entry = this.ensureInput(entry);
        await deleteAppBundleVersion(entry.appbundle, entry.version, this.context);
        this.refresh();
	}

	async viewActivityDetails(entry?: IActivityAliasEntry | ISharedActivityEntry) {
        entry = this.ensureInput(entry);
        const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
        await viewActivityDetails(id, this.context);
	}

	async viewActivityDetailsJSON(entry?: IActivityAliasEntry | ISharedActivityEntry) {
        entry = this.ensureInput(entry);
        const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
        await viewActivityDetailsJSON(id, this.context);
	}

	async viewActivityAliasDetails(entry?: IActivityAliasEntry) {
		await viewActivityAliasDetails(entry ? `${entry.client}.${entry.activity}+${entry.alias}` : undefined, this.context);
	}

	async viewActivityAliasDetailsJSON(entry?: IActivityAliasEntry) {
		await viewActivityAliasDetailsJSON(entry ? `${entry.client}.${entry.activity}+${entry.alias}` : undefined, this.context);
	}

	async viewActivityVersionDetails(entry?: IActivityVersionEntry) {
        entry = this.ensureInput(entry);
        await viewActivityDetails({ name: entry.activity, version: entry.version }, this.context);
	}

	async viewActivityVersionDetailsJSON(entry?: IActivityVersionEntry) {
        entry = this.ensureInput(entry);
        await viewActivityDetailsJSON({ name: entry.activity, version: entry.version }, this.context);
	}

	async deleteActivity(entry?: IActivityEntry) {
        entry = this.ensureInput(entry);
        await deleteActivity(entry.activity, this.context);
        this.refresh();
	}

	async deleteActivityAlias(entry?: IActivityAliasEntry) {
        entry = this.ensureInput(entry);
        await deleteActivityAlias(entry.activity, entry.alias, this.context);
        this.refresh();
	}

	async createActivity() {
        await createActivity(
            (activity: IActivityDetail) => { this.refresh(); },
            this.context
        );
	}

	async updateActivity(entry?: IActivityAliasEntry | IActivityVersionEntry) {
        entry = this.ensureInput(entry);
        await updateActivity(
            'alias' in entry ? `${entry.client}.${entry.activity}+${entry.alias}` : { name: entry.activity, version: entry.version },
            (activity: IActivityDetail) => { this.refresh(); },
            this.context
        );
	}

	async createActivityAlias(entry?: IActivityAliasesEntry) {
        entry = this.ensureInput(entry);
        await createActivityAlias(entry.activity, this.context);
        this.refresh();
	}

	async updateActivityAlias(entry?: IActivityAliasEntry) {
        entry = this.ensureInput(entry);
        await updateActivityAlias(entry.activity, entry.alias, this.context);
	}

	async deleteActivityVersion(entry?: IActivityVersionEntry) {
        entry = this.ensureInput(entry);
        await deleteActivityVersion(entry.activity, entry.version, this.context);
        this.refresh();
	}

	async createWorkItem(entry: IActivityAliasEntry | ISharedActivityEntry) {
        entry = this.ensureInput(entry);
        await createWorkitem(('fullid' in entry) ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`, this.context);
	}
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

async function uploadAppBundle(name: string | undefined, context: IContext) {
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
		showErrorMessage('Could not upload app bundle', err, context);
	}
}

async function viewAppBundleDetails(id: FullyQualifiedID | INameAndVersion | undefined, context: IContext) {
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
		showErrorMessage('Could not access app bundle', err, context);
	}
}

async function viewAppBundleDetailsJSON(id: FullyQualifiedID | INameAndVersion | undefined, context: IContext) {
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
		showErrorMessage('Could not access app bundle', err, context);
	}
}

async function viewAppBundleAliasDetails(id: FullyQualifiedID | undefined, context: IContext) {
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
		showErrorMessage('Could not access app bundle alias', err, context);
	}
}

async function viewAppBundleAliasDetailsJSON(id: FullyQualifiedID | undefined, context: IContext) {
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
		showErrorMessage('Could not access app bundle alias', err, context);
	}
}

async function viewActivityDetails(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		const activityDetail = await withProgress(`Getting activity details: ${id}`, typeof(id) === 'string' ? context.designAutomationClient.getActivity(id) : context.designAutomationClient.getActivityVersion(id.name, id.version));
		createWebViewPanel(context, 'activity-details.js', 'activity-details', `Activity Details: ${activityDetail.id}`, { detail: activityDetail });
	} catch(err) {
		showErrorMessage('Could not access activity', err, context);
	}
}

async function viewActivityDetailsJSON(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		const activityDetail = await withProgress(`Getting activity details: ${id}`, typeof(id) === 'string' ? context.designAutomationClient.getActivity(id) : context.designAutomationClient.getActivityVersion(id.name, id.version));
		createWebViewPanel(context, 'activity-details.js', 'activity-details', `Activity Details: ${activityDetail.id}`, { detail: activityDetail });
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(activityDetail, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch(err) {
		showErrorMessage('Could not access activity', err, context);
	}
}

async function viewActivityAliasDetails(id: FullyQualifiedID | undefined, context: IContext) {
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
		showErrorMessage('Could not access activity alias', err, context);
	}
}

async function viewActivityAliasDetailsJSON(id: FullyQualifiedID | undefined, context: IContext) {
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
		showErrorMessage('Could not access activity alias', err, context);
	}
}

async function createActivity(successCallback: (activity: IActivityDetail) => void, context: IContext) {
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
						showErrorMessage('Could not create activity', err, context);
					}
					break;
			}
		});
	} catch(err) {
		showErrorMessage('Could not create activity', err, context);
	}
}

async function updateActivity(id: FullyQualifiedID | INameAndVersion, successCallback: (activity: IActivityDetail) => void, context: IContext) {
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
						showErrorMessage('Could not update activity', err, context);
					}
					break;
			}
		});
	} catch(err) {
		showErrorMessage('Could not update activity', err, context);
	}
}

async function deleteAppBundle(id: UnqualifiedID, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete app bundle: ${id}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing app bundle: ${id}`, context.designAutomationClient.deleteAppBundle(id));
		vscode.window.showInformationMessage(`App bundle removed`);
	} catch(err) {
		showErrorMessage('Could not remove app bundle', err, context);
	}
}

async function createAppBundleAlias(id: UnqualifiedID, context: IContext) {
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
		showErrorMessage('Could not create app bundle alias', err, context);
	}
}

async function updateAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
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
		showErrorMessage('Could not update app bundle alias', err, context);
	}
}

async function deleteAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete app bundle alias: ${id}/${alias}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing app bundle alias: ${id}/${alias}`, context.designAutomationClient.deleteAppBundleAlias(id, alias));
		vscode.window.showInformationMessage(`App bundle alias removed`);
	} catch(err) {
		showErrorMessage('Could not remove app bundle alias', err, context);
	}
}

async function deleteAppBundleVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete app bundle version: ${id}/${version}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing app bundle version: ${id}/${version}`, context.designAutomationClient.deleteAppBundleVersion(id, version));
		vscode.window.showInformationMessage(`App bundle version removed`);
	} catch(err) {
		showErrorMessage('Could not remove app bundle version', err, context);
	}
}

async function deleteActivity(id: UnqualifiedID, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete activity: ${id}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing activity: ${id}`, context.designAutomationClient.deleteActivity(id));
		vscode.window.showInformationMessage(`Activity removed`);
	} catch(err) {
		showErrorMessage('Could not remove activity', err, context);
	}
}

async function deleteActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete activity alias: ${id}/${alias}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing activity alias: ${id}/${alias}`, context.designAutomationClient.deleteActivityAlias(id, alias));
		vscode.window.showInformationMessage(`Activity alias removed`);
	} catch(err) {
		showErrorMessage('Could not remove activity alias', err, context);
	}
}

async function deleteActivityVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete activity version: ${id}/${version}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		await withProgress(`Removing activity version: ${id}/${version}`, context.designAutomationClient.deleteActivityVersion(id, version));
		vscode.window.showInformationMessage(`Activity version removed`);
	} catch(err) {
		showErrorMessage(`Could not remove activity version`, err, context);
	}
}

async function createActivityAlias(id: UnqualifiedID, context: IContext) {
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
		showErrorMessage('Could not create activity alias', err, context);
	}
}

async function updateActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
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
		showErrorMessage('Could not update activity alias', err, context);
	}
}

async function createWorkitem(id: FullyQualifiedID, context: IContext) {
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
							showErrorMessage('Could not start workitem', err, context);
						}
						// panel.dispose();
						break;
				}
			});
		}
	} catch(err) {
		showErrorMessage('Could not create workitem', err, context);
	}
}
