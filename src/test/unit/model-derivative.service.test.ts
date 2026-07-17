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

	describe('getObjectUrn / getSourceFileFormat', () => {
		const service = new ModelDerivativeService({} as any, {} as any, {} as any, {} as any);

		it('encodes an OSS object as a url-safe base64 urn of its objectId, and reads the format off objectKey', () => {
			const object = { objectId: 'urn:adsk.objects:os.object:my-bucket/model.rvt', objectKey: 'model.rvt' };
			const expected = Buffer.from(object.objectId).toString('base64').replace('/', '_');

			assert.strictEqual(service.getObjectUrn(object as any), expected);
			assert.strictEqual(service.getSourceFileFormat(object as any), 'rvt');
		});

		it('encodes a Hubs version as a url-safe base64 urn of its version id, with no source file format', () => {
			const version = { kind: 'version', itemId: 'item-1', id: 'urn:adsk.wipprod:fs.file:vf.abc?version=1', name: 'model.dwg' };
			const expected = Buffer.from(version.id).toString('base64').replace('/', '_');

			assert.strictEqual(service.getObjectUrn(version as any), expected);
			assert.strictEqual(service.getSourceFileFormat(version as any), '');
		});
	});

	describe('startCustomTranslation (per-output-format payload shaping)', () => {
		const object = { objectId: 'urn:adsk.objects:os.object:my-bucket/model.rvt', objectKey: 'model.rvt' };
		const advanced: any = {
			format: 'ascii', exportColor: true, exportFileStructure: 'flat', unit: 'meter', modelGuid: 'guid-1', objectIds: [1, 2],
			exportSettingName: 'DWG Default', width: 100, height: 200, applicationProtocol: 'AP203', tolerance: 0.01,
			surfaceType: 'quad', sheetType: 'model', solidType: 'solid',
			extraSvfOption: 'foo' // not picked out by any named branch below - only svf/svf2 spreads leftovers like this
		};

		async function buildPayload(outputFormat: string, views2d = false, views3d = false): Promise<{ payload: any; options: any }> {
			let payload: any;
			let options: any;
			const fakeClient = { startJob: async (jobPayload: any, jobOptions: any) => { payload = jobPayload; options = jobOptions; } };
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);
			await service.startCustomTranslation(object as any, {
				outputFormat, compressedUrn: false, rootFilename: '', views2d, views3d,
				advanced, workflowId: '', workflowAttributes: ''
			} as any);
			return { payload, options };
		}

		it('forces re-translation via xAdsForce', async () => {
			const { options } = await buildPayload('svf2');
			assert.deepStrictEqual(options, { xAdsForce: true });
		});

		it('assembles svf2 views from views2d/views3d and keeps only the leftover advanced fields', async () => {
			const { payload } = await buildPayload('svf2', true, true);
			const format = payload.output.formats[0];
			assert.strictEqual(format.type, 'svf2');
			assert.deepStrictEqual(format.views, ['2d', '3d']);
			assert.deepStrictEqual(format.advanced, { extraSvfOption: 'foo' });
		});

		it('assembles svf with just the requested view', async () => {
			const { payload } = await buildPayload('svf', true, false);
			assert.deepStrictEqual(payload.output.formats[0].views, ['2d']);
		});

		it('picks {width, height} for thumbnail', async () => {
			const { payload } = await buildPayload('thumbnail');
			assert.deepStrictEqual(payload.output.formats[0].advanced, { width: 100, height: 200 });
		});

		it('nests {format, exportColor, exportFileStructure} for stl', async () => {
			const { payload } = await buildPayload('stl');
			assert.deepStrictEqual(payload.output.formats[0].advanced, { advanced: { format: 'ascii', exportColor: true, exportFileStructure: 'flat' } });
		});

		it('nests {exportFileStructure, unit, modelGuid, objectIds} for obj', async () => {
			const { payload } = await buildPayload('obj');
			assert.deepStrictEqual(payload.output.formats[0].advanced, { advanced: { exportFileStructure: 'flat', unit: 'meter', modelGuid: 'guid-1', objectIds: [1, 2] } });
		});

		it('picks {applicationProtocol, tolerance} for step', async () => {
			const { payload } = await buildPayload('step');
			assert.deepStrictEqual(payload.output.formats[0].advanced, { applicationProtocol: 'AP203', tolerance: 0.01 });
		});

		it('picks {tolerance, surfaceType, sheetType, solidType} for iges', async () => {
			const { payload } = await buildPayload('iges');
			assert.deepStrictEqual(payload.output.formats[0].advanced, { tolerance: 0.01, surfaceType: 'quad', sheetType: 'model', solidType: 'solid' });
		});

		it('picks {exportSettingName} for dwg and ifc', async () => {
			assert.deepStrictEqual((await buildPayload('dwg')).payload.output.formats[0].advanced, { exportSettingName: 'DWG Default' });
			assert.deepStrictEqual((await buildPayload('ifc')).payload.output.formats[0].advanced, { exportSettingName: 'DWG Default' });
		});

		it('has no advanced bag for formats with no typed advanced options (e.g. fbx)', async () => {
			const { payload } = await buildPayload('fbx');
			assert.strictEqual(payload.output.formats[0].advanced, undefined);
		});

		it('only forwards rootFilename when compressedUrn is true', async () => {
			let payload: any;
			const fakeClient = { startJob: async (jobPayload: any) => { payload = jobPayload; } };
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);

			await service.startCustomTranslation(object as any, {
				outputFormat: 'svf2', compressedUrn: true, rootFilename: 'model.rvt', views2d: false, views3d: false,
				advanced: {}, workflowId: '', workflowAttributes: ''
			} as any);
			assert.strictEqual(payload.input.rootFilename, 'model.rvt');

			await service.startCustomTranslation(object as any, {
				outputFormat: 'svf2', compressedUrn: false, rootFilename: 'model.rvt', views2d: false, views3d: false,
				advanced: {}, workflowId: '', workflowAttributes: ''
			} as any);
			assert.strictEqual(payload.input.rootFilename, undefined);
		});

		it('includes a workflow block only when workflowId is set, parsing workflowAttributes as JSON', async () => {
			let payload: any;
			const fakeClient = { startJob: async (jobPayload: any) => { payload = jobPayload; } };
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);

			await service.startCustomTranslation(object as any, {
				outputFormat: 'svf2', compressedUrn: false, rootFilename: '', views2d: false, views3d: false,
				advanced: {}, workflowId: 'wf-1', workflowAttributes: '{"a":1}'
			} as any);
			assert.deepStrictEqual(payload.misc, { workflow: 'wf-1', workflowAttribute: { a: 1 } });

			await service.startCustomTranslation(object as any, {
				outputFormat: 'svf2', compressedUrn: false, rootFilename: '', views2d: false, views3d: false,
				advanced: {}, workflowId: '', workflowAttributes: ''
			} as any);
			assert.strictEqual(payload.misc, undefined);
		});
	});

	describe('getViewableDerivatives', () => {
		it('returns null when the manifest has no svf/svf2 derivative', async () => {
			const fakeClient = { getManifest: async () => ({ derivatives: [{ outputType: 'obj', children: [] }] }) };
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);
			assert.strictEqual(await service.getViewableDerivatives('my-bucket/model.rvt'), null);
		});

		it('maps only the geometry children of the viewable derivative, keyed by the plain (non-url-safe) base64 urn', async () => {
			const objectId = 'my-bucket/model.rvt';
			const fakeClient = {
				getManifest: async () => ({
					derivatives: [{
						outputType: 'svf2',
						children: [
							{ type: 'geometry', name: 'View1', role: '3d', guid: 'guid-1' },
							{ type: 'resource', role: 'other' }
						]
					}]
				})
			};
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);
			const result = await service.getViewableDerivatives(objectId);

			assert.deepStrictEqual(result!.map(d => ({ urn: d.urn, name: d.name, guid: d.guid })), [
				{ urn: Buffer.from(objectId).toString('base64'), name: 'View1', guid: 'guid-1' }
			]);
		});
	});

	describe('getCustomDerivatives', () => {
		it('keeps only supported, non-viewable derivatives, and only children whose role matches the derivative', async () => {
			const objectId = 'my-bucket/model.rvt';
			const fakeClient = {
				getFormats: async () => ({ formats: { obj: ['rvt'], dwg: ['rvt'] } }),
				getManifest: async () => ({
					derivatives: [
						{ outputType: 'svf2', children: [{ role: '3d', urn: 'urn:x/View1', guid: 'g0' }] }, // viewable -> excluded
						{
							outputType: 'obj', children: [
								{ role: 'obj', urn: 'urn:adsk.viewing:fs.file:xyz/output/model.obj', guid: 'g1' },
								{ role: 'other', urn: 'urn:x/ignored', guid: 'g2' } // role doesn't match outputType -> excluded
							]
						},
						{ outputType: 'unsupported-format', children: [{ role: 'unsupported-format', urn: 'urn:x/ignored2', guid: 'g3' }] } // not in formats -> excluded
					]
				})
			};
			const service = new ModelDerivativeService(fakeClient as any, {} as any, {} as any, {} as any);
			const result = await service.getCustomDerivatives(objectId);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, 'model.obj');
			assert.strictEqual(result[0].format, 'obj');
			assert.strictEqual(result[0].guid, 'g1');
		});
	});
});
