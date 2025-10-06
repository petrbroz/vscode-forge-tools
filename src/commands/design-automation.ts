import * as fs from 'fs';
import * as vscode from 'vscode';
import axios from 'axios';
import { IContext, promptAppBundleFullID, promptEngine, showErrorMessage } from '../common';
import { IAppBundleUploadParams, IActivityDetail, DesignAutomationID } from 'aps-sdk-node';
import { withProgress, createWebViewPanel } from '../common';
import { ICreateActivityProps } from '../webviews/create-activity';
import { IAppBundleEntry, IAppBundleAliasEntry, ISharedAppBundleEntry, IAppBundleVersionEntry, IAppBundleAliasesEntry, IActivityAliasEntry, ISharedActivityEntry, IActivityVersionEntry, IActivityEntry, IActivityAliasesEntry } from '../interfaces/design-automation';
import { CommandCategory, Command, CommandRegistry } from './shared';

type FullyQualifiedID = string;
type UnqualifiedID = string;
interface INameAndVersion {
	name: string;
	version: number;
}

@CommandCategory({ category: 'Design Automation', prefix: 'aps.da' })
export class DesignAutomationCommands extends CommandRegistry {
	constructor(protected context: IContext, protected refresh: () => void) {
		super();
	}

    @Command({
        title: 'Refresh Design Automation Tree',
        icon: 'refresh',
        menus: {
            'view/title': [{ when: 'view == apsDesignAutomationView', group: 'navigation' }]
        }
    })
    async refreshDesignAutomationTree() {
        this.refresh();
    }

	@Command({
		title: 'Create App Bundle',
		icon: 'add',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == owned-appbundles', group: '2_modify' }]
		}
	})
	async createAppBundle() {
        await uploadAppBundle(undefined, this.context);
        this.refresh();
	}

	@Command({
		title: 'Update App Bundle',
		icon: 'edit',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == owned-appbundle', group: '2_modify' }]
		}
	})
	async updateAppBundle(entry?: IAppBundleEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await uploadAppBundle(entry.appbundle, this.context);
        this.refresh();
	}

	@Command({
		title: 'View App Bundle Details',
		icon: 'eye',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '0_view' },
				{ when: 'view == apsDesignAutomationView && viewItem == shared-appbundle', group: '0_view' }
			]
		}
	})
	async viewAppBundleDetails(entry?: IAppBundleAliasEntry | ISharedAppBundleEntry) {
        if (entry) {
            await viewAppBundleDetails('fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`, this.context);
        } else {
            await viewAppBundleDetails(undefined, this.context);
        }
	}

	@Command({
		title: 'View App Bundle Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '0_view' },
				{ when: 'view == apsDesignAutomationView && viewItem == shared-appbundle', group: '0_view' }
			]
		}
	})
	async viewAppBundleDetailsJSON(entry?: IAppBundleAliasEntry | ISharedAppBundleEntry) {
        if (entry) {
            await viewAppBundleDetailsJSON('fullid' in entry ? entry.fullid : `${entry.client}.${entry.appbundle}+${entry.alias}`, this.context);
        } else {
            await viewAppBundleDetailsJSON(undefined, this.context);
        }
	}

	@Command({
		title: 'View App Bundle Details',
		icon: 'eye',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '0_view' }]
		}
	})
	async viewAppBundleAliasDetails(entry?: IAppBundleAliasEntry) {
		await viewAppBundleAliasDetails(entry ? `${entry.client}.${entry.appbundle}+${entry.alias}` : undefined, this.context);
	}

	@Command({
		title: 'View App Bundle Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '0_view' }]
		}
	})
	async viewAppBundleAliasDetailsJSON(entry?: IAppBundleAliasEntry) {
		await viewAppBundleAliasDetailsJSON(entry ? `${entry.client}.${entry.appbundle}+${entry.alias}` : undefined, this.context);
	}

	@Command({
		title: 'View App Bundle Details',
		icon: 'eye',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-version', group: '0_view' }]
		}
	})
	async viewAppBundleVersionDetails(entry?: IAppBundleVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await viewAppBundleDetails({ name: entry.appbundle, version: entry.version }, this.context);
	}

	@Command({
		title: 'View App Bundle Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-version', group: '0_view' }]
		}
	})
	async viewAppBundleVersionDetailsJSON(entry?: IAppBundleVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await viewAppBundleDetailsJSON({ name: entry.appbundle, version: entry.version }, this.context);
	}

	@Command({
		title: 'Delete App Bundle',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == owned-appbundle', group: '3_remove' }]
		}
	})
	async deleteAppBundle(entry?: IAppBundleEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteAppBundle(entry.appbundle, this.context);
        this.refresh();
	}

	@Command({
		title: 'Delete App Bundle Alias',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '3_remove' }]
		}
	})
	async deleteAppBundleAlias(entry?: IAppBundleAliasEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteAppBundleAlias(entry.appbundle, entry.alias, this.context);
        this.refresh();
	}

	@Command({
		title: 'Create App Bundle Alias',
		icon: 'add',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-aliases', group: '2_modify' }]
		}
	})
	async createAppBundleAlias(entry?: IAppBundleAliasesEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await createAppBundleAlias(entry.appbundle, this.context);
        this.refresh();
	}

	@Command({
		title: 'Update App Bundle Alias',
		icon: 'edit',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-alias', group: '2_modify' }]
		}
	})
	async updateAppBundleAlias(entry?: IAppBundleAliasEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await updateAppBundleAlias(entry.appbundle, entry.alias, this.context);
	}

	@Command({
		title: 'Delete App Bundle Version',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == appbundle-version', group: '3_remove' }]
		}
	})
	async deleteAppBundleVersion(entry?: IAppBundleVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteAppBundleVersion(entry.appbundle, entry.version, this.context);
        this.refresh();
	}

	@Command({
		title: 'View Activity Details',
		icon: 'eye',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '0_view' },
				{ when: 'view == apsDesignAutomationView && viewItem == shared-activity', group: '0_view' }
			]
		}
	})
	async viewActivityDetails(entry?: IActivityAliasEntry | ISharedActivityEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
        await viewActivityDetails(id, this.context);
	}

	@Command({
		title: 'View Activity Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '0_view' },
				{ when: 'view == apsDesignAutomationView && viewItem == shared-activity', group: '0_view' }
			]
		}
	})
	async viewActivityDetailsJSON(entry?: IActivityAliasEntry | ISharedActivityEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        const id = 'fullid' in entry ? entry.fullid : `${entry.client}.${entry.activity}+${entry.alias}`;
        await viewActivityDetailsJSON(id, this.context);
	}

	@Command({
		title: 'View Activity Details',
		icon: 'eye',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '0_view' }]
		}
	})
	async viewActivityAliasDetails(entry?: IActivityAliasEntry) {
		await viewActivityAliasDetails(entry ? `${entry.client}.${entry.activity}+${entry.alias}` : undefined, this.context);
	}

	@Command({
		title: 'View Activity Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '0_view' }]
		}
	})
	async viewActivityAliasDetailsJSON(entry?: IActivityAliasEntry) {
		await viewActivityAliasDetailsJSON(entry ? `${entry.client}.${entry.activity}+${entry.alias}` : undefined, this.context);
	}

	@Command({
		title: 'View Activity Details',
		icon: 'eye',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-version', group: '0_view' }]
		}
	})
	async viewActivityVersionDetails(entry?: IActivityVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await viewActivityDetails({ name: entry.activity, version: entry.version }, this.context);
	}

	@Command({
		title: 'View Activity Details (JSON)',
		icon: 'json',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-version', group: '0_view' }]
		}
	})
	async viewActivityVersionDetailsJSON(entry?: IActivityVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await viewActivityDetailsJSON({ name: entry.activity, version: entry.version }, this.context);
	}

	@Command({
		title: 'Delete Activity',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == owned-activity', group: '3_remove' }]
		}
	})
	async deleteActivity(entry?: IActivityEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteActivity(entry.activity, this.context);
        this.refresh();
	}

	@Command({
		title: 'Delete Activity Alias',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '3_remove' }]
		}
	})
	async deleteActivityAlias(entry?: IActivityAliasEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteActivityAlias(entry.activity, entry.alias, this.context);
        this.refresh();
	}

	@Command({
		title: 'Create Activity',
		icon: 'add',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == owned-activities', group: '2_modify' }]
		}
	})
	async createActivity() {
        await createActivity(
            (activity: IActivityDetail) => { this.refresh(); },
            this.context
        );
	}

	@Command({
		title: 'Update Activity',
		icon: 'edit',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '2_modify' },
				{ when: 'view == apsDesignAutomationView && viewItem == activity-version', group: '2_modify' }
			]
		}
	})
	async updateActivity(entry?: IActivityAliasEntry | IActivityVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await updateActivity(
            'alias' in entry ? `${entry.client}.${entry.activity}+${entry.alias}` : { name: entry.activity, version: entry.version },
            (activity: IActivityDetail) => { this.refresh(); },
            this.context
        );
	}

	@Command({
		title: 'Create Activity Alias',
		icon: 'add',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-aliases', group: '2_modify' }]
		}
	})
	async createActivityAlias(entry?: IActivityAliasesEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await createActivityAlias(entry.activity, this.context);
        this.refresh();
	}

	@Command({
		title: 'Update Activity Alias',
		icon: 'edit',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '2_modify' }]
		}
	})
	async updateActivityAlias(entry?: IActivityAliasEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await updateActivityAlias(entry.activity, entry.alias, this.context);
	}

	@Command({
		title: 'Delete Activity Version',
		icon: 'trash',
		menus: {
			'view/item/context': [{ when: 'view == apsDesignAutomationView && viewItem == activity-version', group: '3_remove' }]
		}
	})
	async deleteActivityVersion(entry?: IActivityVersionEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await deleteActivityVersion(entry.activity, entry.version, this.context);
        this.refresh();
	}

	@Command({
		title: 'Create Work Item',
		icon: 'play',
		menus: {
			'view/item/context': [
				{ when: 'view == apsDesignAutomationView && viewItem == activity-alias', group: '2_modify' },
				{ when: 'view == apsDesignAutomationView && viewItem == shared-activity', group: '2_modify' }
			]
		}
	})
	async createWorkItem(entry: IActivityAliasEntry | ISharedActivityEntry) {
        if (!entry) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
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
