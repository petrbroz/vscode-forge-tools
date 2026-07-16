import * as assert from 'assert';
import { ModelDerivativeService } from '../../services/model-derivative';

describe('ModelDerivativeService', () => {
	describe('client selection (2-legged vs 3-legged)', () => {
		const manifest2L = { status: 'success', source: '2L' };
		const manifest3L = { status: 'success', source: '3L' };
		const fakeClient2L = { getManifest: async () => manifest2L };
		const fakeClient3L = { getManifest: async () => manifest3L };
		const ossObject = { objectId: 'urn:adsk.objects:os.object:my-bucket/model.rvt', objectKey: 'model.rvt' };
		const hubsVersion = { kind: 'version', itemId: 'item-1', id: 'version-1', name: 'v1' };

		it('always uses the 2-legged client for OSS objects, regardless of login state', async () => {
			const noToken = new ModelDerivativeService(fakeClient2L as any, fakeClient3L as any, {} as any, 'id', 'secret');
			const withToken = new ModelDerivativeService(fakeClient2L as any, fakeClient3L as any, {} as any, 'id', 'secret', 'three-legged-token');

			assert.strictEqual(await noToken.getObjectManifest(ossObject as any), manifest2L);
			assert.strictEqual(await withToken.getObjectManifest(ossObject as any), manifest2L);
		});

		it('uses the 2-legged client for Hubs versions when not logged in', async () => {
			const service = new ModelDerivativeService(fakeClient2L as any, fakeClient3L as any, {} as any, 'id', 'secret');
			assert.strictEqual(await service.getObjectManifest(hubsVersion as any), manifest2L);
		});

		it('uses the 3-legged client for Hubs versions when logged in', async () => {
			const service = new ModelDerivativeService(fakeClient2L as any, fakeClient3L as any, {} as any, 'id', 'secret', 'three-legged-token');
			assert.strictEqual(await service.getObjectManifest(hubsVersion as any), manifest3L);
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
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, 'id', 'secret');
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
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, 'id', 'secret');
			const object = { objectId: 'urn:x', objectKey: 'model.rvt' };

			await assert.rejects(() => service.getSupportedOutputFormats(object as any));
			assert.deepStrictEqual(await service.getSupportedOutputFormats(object as any), ['svf2']);
			assert.strictEqual(attempts, 2);
		});
	});

	describe('getManifestDerivatives', () => {
		it('maps a viewable (svf2) derivative to geometry view models', async () => {
			const fakeClient2L = { getFormats: async () => ({ formats: { svf2: ['rvt'] } }) };
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, 'id', 'secret');
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
			const service = new ModelDerivativeService(fakeClient2L as any, {} as any, {} as any, 'id', 'secret');
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
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, 'id', 'secret');
			const manifest = {
				status: 'success',
				derivatives: [{ outputType: 'svf2', children: [{ type: 'geometry', name: 'View1', role: '3d', guid: 'guid-1' }] }]
			};

			const result = await service.getVersionDerivatives('version-1', manifest as any);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, 'View1');
		});

		it('throws when the manifest status is not success', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, 'id', 'secret');
			await assert.rejects(() => service.getVersionDerivatives('version-1', { status: 'failed', derivatives: [] } as any));
		});

		it('returns an empty array when there is no viewable derivative yet', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, 'id', 'secret');
			const manifest = { status: 'success', derivatives: [] };
			assert.deepStrictEqual(await service.getVersionDerivatives('version-1', manifest as any), []);
		});
	});

	describe('getViewerAccessToken', () => {
		it('returns the stored 3-legged token for Hubs URNs when logged in', async () => {
			const service = new ModelDerivativeService({} as any, {} as any, {} as any, 'id', 'secret', 'my-3l-token');
			assert.strictEqual(await service.getViewerAccessToken('url_safe_hubs_urn'), 'my-3l-token');
		});

		it('fetches a fresh 2-legged token otherwise', async () => {
			let received: any;
			const fakeAuthenticationClient = {
				getTwoLeggedToken: async (clientId: string, clientSecret: string, scopes: string[]) => {
					received = { clientId, clientSecret, scopes };
					return { access_token: 'fresh-2l-token' };
				}
			};
			const service = new ModelDerivativeService({} as any, {} as any, fakeAuthenticationClient as any, 'my-id', 'my-secret');

			assert.strictEqual(await service.getViewerAccessToken('plainurn'), 'fresh-2l-token');
			assert.strictEqual(received.clientId, 'my-id');
			assert.strictEqual(received.clientSecret, 'my-secret');
		});
	});
});
