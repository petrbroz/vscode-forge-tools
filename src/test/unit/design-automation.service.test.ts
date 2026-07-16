import * as assert from 'assert';
import { DesignAutomationService } from '../../services/design-automation';

describe('DesignAutomationService', () => {
	describe('getOwnedAppBundles / getSharedAppBundles', () => {
		it('splits full IDs by owner, deduping owned bare IDs', async () => {
			let nicknameCalls = 0;
			const fakeClient = {
				getNickname: async () => {
					nicknameCalls++;
					return 'nick1';
				},
				listAppBundles: async () => ['nick1.Bundle1+$LATEST', 'nick1.Bundle1+1', 'other.Bundle2+1']
			};

			const service = new DesignAutomationService(fakeClient as any);

			const owned = await service.getOwnedAppBundles();
			assert.strictEqual(owned.nickname, 'nick1');
			assert.deepStrictEqual(owned.ids, ['Bundle1']);

			const shared = await service.getSharedAppBundles();
			assert.deepStrictEqual(shared, ['other.Bundle2+1']);

			// The nickname is fetched once and cached across both calls.
			assert.strictEqual(nicknameCalls, 1);
		});
	});

	describe('getOwnedActivities / getSharedActivities', () => {
		it('splits full IDs by owner', async () => {
			const fakeClient = {
				getNickname: async () => 'nick1',
				listActivities: async () => ['nick1.Activity1+1', 'other.Activity2+1']
			};

			const service = new DesignAutomationService(fakeClient as any);
			assert.deepStrictEqual((await service.getOwnedActivities()).ids, ['Activity1']);
			assert.deepStrictEqual(await service.getSharedActivities(), ['other.Activity2+1']);
		});
	});

	describe('getAppBundleAliases / getActivityAliases', () => {
		it('filters out the $LATEST pseudo-alias', async () => {
			const aliases = [{ id: '$LATEST', version: 3 }, { id: 'v1', version: 1 }];
			const fakeClient = {
				listAppBundleAliases: async () => aliases,
				listActivityAliases: async () => aliases
			};

			const service = new DesignAutomationService(fakeClient as any);
			assert.deepStrictEqual((await service.getAppBundleAliases('bundle-1')).map(a => a.id), ['v1']);
			assert.deepStrictEqual((await service.getActivityAliases('activity-1')).map(a => a.id), ['v1']);
		});
	});

	describe('waitForWorkItem', () => {
		it('polls until the work item leaves pending/inprogress, invoking onProgress', async function () {
			this.timeout(10000);
			const fakeClient = {
				getWorkItem: async (id: string) => {
					assert.strictEqual(id, 'wi-1');
					return { id: 'wi-1', status: 'success', reportUrl: '' };
				}
			};
			const progress: string[] = [];

			const service = new DesignAutomationService(fakeClient as any);
			const result = await service.waitForWorkItem(
				{ id: 'wi-1', status: 'inprogress', reportUrl: '' },
				status => progress.push(status)
			);

			assert.strictEqual(result.status, 'success');
			assert.deepStrictEqual(progress, ['success']);
		});

		it('returns immediately without polling when already in a terminal state', async () => {
			const fakeClient = { getWorkItem: async () => { throw new Error('should not be called'); } };
			const service = new DesignAutomationService(fakeClient as any);
			const workitem = { id: 'wi-1', status: 'success', reportUrl: '' };
			assert.strictEqual(await service.waitForWorkItem(workitem), workitem);
		});
	});
});
