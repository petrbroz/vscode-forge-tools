import * as assert from 'assert';
import * as vscode from 'vscode';
import { DesignAutomationDataProvider } from '../../providers/design-automation';

function makeProvider(designAutomationService: any): DesignAutomationDataProvider {
	return new DesignAutomationDataProvider({ designAutomationService } as any);
}

describe('DesignAutomationDataProvider', () => {
	describe('getChildren (root)', () => {
		it('lists the four fixed top-level groups', async () => {
			const provider = makeProvider({});
			const children = await provider.getChildren();

			assert.deepStrictEqual(children.map(c => c.type), ['owned-appbundles', 'shared-appbundles', 'owned-activities', 'shared-activities']);
			assert.deepStrictEqual(children.map(c => c.label), ['Owned App Bundles', 'Shared App Bundles', 'Owned Activities', 'Shared Activities']);
		});
	});

	describe('app bundles', () => {
		it('maps owned app bundle ids to owned-appbundle entries tagged with the nickname', async () => {
			const provider = makeProvider({ getOwnedAppBundles: async () => ({ nickname: 'nick1', ids: ['Bundle1', 'Bundle2'] }) });
			const children = await provider.getChildren({ type: 'owned-appbundles', label: 'Owned App Bundles' });

			assert.deepStrictEqual(children, [
				{ type: 'owned-appbundle', client: 'nick1', appbundle: 'Bundle1', label: 'Bundle1' },
				{ type: 'owned-appbundle', client: 'nick1', appbundle: 'Bundle2', label: 'Bundle2' }
			]);
		});

		it('maps shared app bundle full ids to shared-appbundle entries', async () => {
			const provider = makeProvider({ getSharedAppBundles: async () => ['other.Bundle3+1'] });
			const children = await provider.getChildren({ type: 'shared-appbundles', label: 'Shared App Bundles' });

			assert.deepStrictEqual(children, [{ type: 'shared-appbundle', fullid: 'other.Bundle3+1', label: 'other.Bundle3+1' }]);
		});

		it('gives an owned app bundle "Aliases" and "Versions" children, propagating client/appbundle', async () => {
			const provider = makeProvider({});
			const children = await provider.getChildren({ type: 'owned-appbundle', client: 'nick1', appbundle: 'Bundle1', label: 'Bundle1' });

			assert.deepStrictEqual(children, [
				{ type: 'appbundle-aliases', client: 'nick1', appbundle: 'Bundle1', label: 'Aliases' },
				{ type: 'appbundle-versions', client: 'nick1', appbundle: 'Bundle1', label: 'Versions' }
			]);
		});

		it('maps app bundle aliases to appbundle-alias entries', async () => {
			const provider = makeProvider({ getAppBundleAliases: async (id: string) => { assert.strictEqual(id, 'Bundle1'); return [{ id: 'prod', version: 3 }]; } });
			const children = await provider.getChildren({ type: 'appbundle-aliases', client: 'nick1', appbundle: 'Bundle1', label: 'Aliases' });

			assert.deepStrictEqual(children, [{ type: 'appbundle-alias', client: 'nick1', appbundle: 'Bundle1', alias: 'prod', label: 'prod', version: 3 }]);
		});

		it('maps app bundle versions to appbundle-version entries', async () => {
			const provider = makeProvider({ listAppBundleVersions: async (id: string) => { assert.strictEqual(id, 'Bundle1'); return [1, 2]; } });
			const children = await provider.getChildren({ type: 'appbundle-versions', client: 'nick1', appbundle: 'Bundle1', label: 'Versions' });

			assert.deepStrictEqual(children, [
				{ type: 'appbundle-version', client: 'nick1', appbundle: 'Bundle1', version: 1, label: '1' },
				{ type: 'appbundle-version', client: 'nick1', appbundle: 'Bundle1', version: 2, label: '2' }
			]);
		});
	});

	describe('activities', () => {
		it('maps owned activity ids to owned-activity entries tagged with the nickname', async () => {
			const provider = makeProvider({ getOwnedActivities: async () => ({ nickname: 'nick1', ids: ['Activity1'] }) });
			const children = await provider.getChildren({ type: 'owned-activities', label: 'Owned Activities' });

			assert.deepStrictEqual(children, [{ type: 'owned-activity', client: 'nick1', activity: 'Activity1', label: 'Activity1' }]);
		});

		it('maps shared activity full ids to shared-activity entries', async () => {
			const provider = makeProvider({ getSharedActivities: async () => ['other.Activity2+1'] });
			const children = await provider.getChildren({ type: 'shared-activities', label: 'Shared Activities' });

			assert.deepStrictEqual(children, [{ type: 'shared-activity', fullid: 'other.Activity2+1', label: 'other.Activity2+1' }]);
		});

		it('maps activity aliases to activity-alias entries', async () => {
			const provider = makeProvider({ getActivityAliases: async () => [{ id: 'prod', version: 2 }] });
			const children = await provider.getChildren({ type: 'activity-aliases', client: 'nick1', activity: 'Activity1', label: 'Aliases' });

			assert.deepStrictEqual(children, [{ type: 'activity-alias', client: 'nick1', activity: 'Activity1', alias: 'prod', label: 'prod', version: 2 }]);
		});

		it('maps activity versions to activity-version entries', async () => {
			const provider = makeProvider({ listActivityVersions: async () => [1] });
			const children = await provider.getChildren({ type: 'activity-versions', client: 'nick1', activity: 'Activity1', label: 'Versions' });

			assert.deepStrictEqual(children, [{ type: 'activity-version', client: 'nick1', activity: 'Activity1', version: 1, label: '1' }]);
		});
	});

	describe('unexpected entry type', () => {
		it('throws from getChildren', async () => {
			const provider = makeProvider({});
			await assert.rejects(() => provider.getChildren({ type: 'not-a-real-type', label: 'x' } as any));
		});

		it('throws from getTreeItem', () => {
			const provider = makeProvider({});
			assert.throws(() => provider.getTreeItem({ type: 'not-a-real-type', label: 'x' } as any));
		});
	});

	describe('getTreeItem', () => {
		const provider = makeProvider({});

		it('renders a collapsible node for a group-shaped entry, with the mapped icon and contextValue', () => {
			const node = provider.getTreeItem({ type: 'owned-appbundles', label: 'Owned App Bundles' }) as vscode.TreeItem;
			assert.strictEqual(node.label, 'Owned App Bundles');
			assert.strictEqual(node.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
			assert.strictEqual((node.iconPath as vscode.ThemeIcon).id, 'plug');
			assert.strictEqual(node.contextValue, 'owned-appbundles');
		});

		it('renders a leaf node for a version-shaped entry', () => {
			const node = provider.getTreeItem({ type: 'appbundle-version', client: 'nick1', appbundle: 'Bundle1', version: 3, label: '3' }) as vscode.TreeItem;
			assert.strictEqual(node.label, '3');
			assert.strictEqual(node.collapsibleState, vscode.TreeItemCollapsibleState.None);
			assert.strictEqual((node.iconPath as vscode.ThemeIcon).id, 'versions');
		});

		it('appends "[v<version>]" to the label of an alias-shaped entry', () => {
			const node = provider.getTreeItem({ type: 'appbundle-alias', client: 'nick1', appbundle: 'Bundle1', alias: 'prod', label: 'prod', version: 3 }) as vscode.TreeItem;
			assert.strictEqual(node.label, 'prod [v3]');
			assert.strictEqual((node.iconPath as vscode.ThemeIcon).id, 'references');
		});
	});
});
