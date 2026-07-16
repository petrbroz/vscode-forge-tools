import * as assert from 'assert';
import { ModelDerivativeService } from '../../services/model-derivative';

describe('ModelDerivativeService', () => {
	describe('client selection (app vs user context)', () => {
		const manifestApp = { status: 'success', source: 'app' };
		const manifestUser = { status: 'success', source: 'user' };
		const fakeAppClient = { getManifest: async () => manifestApp };
		const fakeUserClient = { getManifest: async () => manifestUser };
		const ossObject = { objectId: 'urn:adsk.objects:os.object:my-bucket/model.rvt', objectKey: 'model.rvt' };
		const hubsVersion = { kind: 'version', itemId: 'item-1', id: 'version-1', name: 'v1' };
		const service = new ModelDerivativeService(fakeAppClient as any, fakeUserClient as any, {} as any, {} as any);

		it('uses the app (2-legged) client for OSS objects', async () => {
			assert.strictEqual(await service.getObjectManifest(ossObject as any), manifestApp);
		});

		it('uses the user client for Hubs versions', async () => {
			assert.strictEqual(await service.getObjectManifest(hubsVersion as any), manifestUser);
		});
	});

	describe('getSupportedOutputFormats (format cache)', () => {
		it('fetches the formats list once and reuses it across calls', async () => {
			let calls = 0;
			const fakeClient2L = {
				getFormats: async () => {
					calls++;
					return { formats: { svf2: ['rvt'] } };
				}
			};
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, {} as any);
			const object = { objectId: 'urn:x', objectKey: 'model.rvt' };

			assert.deepStrictEqual(await service.getSupportedOutputFormats(object as any), ['svf2']);
			assert.deepStrictEqual(await service.getSupportedOutputFormats(object as any), ['svf2']);
			assert.strictEqual(calls, 1);
		});

		it('does not cache a failed fetch, so the next call can retry', async () => {
			let attempts = 0;
			const fakeClient2L = {
				getFormats: async () => {
					attempts++;
					if (attempts === 1) {
						throw new Error('network blip');
					}
					return { formats: { svf2: ['rvt'] } };
				}
			};
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, {} as any);
			const object = { objectId: 'urn:x', objectKey: 'model.rvt' };

			await assert.rejects(() => service.getSupportedOutputFormats(object as any));
			assert.deepStrictEqual(await service.getSupportedOutputFormats(object as any), ['svf2']);
			assert.strictEqual(attempts, 2);
		});
	});

	describe('getManifestDerivatives', () => {
		it('maps a viewable (svf2) derivative to geometry view models', async () => {
			const fakeClient2L = { getFormats: async () => ({ formats: { svf2: ['rvt'] } }) };
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, {} as any);
			const manifest = {
				derivatives: [
					{
						outputType: 'svf2',
						children: [
							{ type: 'geometry', name: 'View1', role: '3d', guid: 'guid-1' },
							{ type: 'resource', role: 'other' }
						]
					}
				]
			};

			const result = await service.getManifestDerivatives(manifest as any, 'urn-1');

			assert.deepStrictEqual(result.map(d => ({ urn: d.urn, name: d.name, guid: d.guid, format: d.format })), [
				{ urn: 'urn-1', name: 'View1', guid: 'guid-1', format: 'svf2' }
			]);
		});

		it('maps a non-viewable derivative to downloadable resource view models', async () => {
			const fakeClient2L = { getFormats: async () => ({ formats: { obj: ['rvt'] } }) };
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, {} as any);
			const manifest = {
				derivatives: [
					{
						outputType: 'obj',
						children: [
							{ role: 'obj', urn: 'urn:adsk.viewing:fs.file:xyz/output/model.obj', guid: 'child-guid' },
							{ role: 'other' }
						]
					}
				]
			};

			const result = await service.getManifestDerivatives(manifest as any, 'urn-1');

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].nonViewable, true);
			assert.strictEqual(result[0].format, 'obj');
			assert.strictEqual(result[0].name, 'model.obj');
		});
	});

	describe('getVersionDerivatives', () => {
		it('returns geometry derivatives for an already-translated version', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, {} as any);
			const manifest = {
				status: 'success',
				derivatives: [{ outputType: 'svf2', children: [{ type: 'geometry', name: 'View1', role: '3d', guid: 'guid-1' }] }]
			};

			const result = await service.getVersionDerivatives('version-1', manifest as any);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, 'View1');
		});

		it('throws when the manifest status is not success', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, {} as any);
			await assert.rejects(() => service.getVersionDerivatives('version-1', { status: 'failed', derivatives: [] } as any));
		});

		it('returns an empty array when there is no viewable derivative yet', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, {} as any);
			const manifest = { status: 'success', derivatives: [] };
			assert.deepStrictEqual(await service.getVersionDerivatives('version-1', manifest as any), []);
		});
	});

	describe('getViewerAccessToken', () => {
		const appViewerProvider = { getAccessToken: async () => 'app-viewer-token' };
		const userProvider = { getAccessToken: async () => 'user-token' };
		const service = new ModelDerivativeService({} as any, {} as any, appViewerProvider as any, userProvider as any);

		it('returns the user-context token for Hubs URNs', async () => {
			assert.strictEqual(await service.getViewerAccessToken('url_safe_hubs_urn'), 'user-token');
		});

		it('returns an app (viewables:read) token for OSS URNs', async () => {
			assert.strictEqual(await service.getViewerAccessToken('plainurn'), 'app-viewer-token');
		});
	});
});
