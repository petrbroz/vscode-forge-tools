import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ApsLanguageModelTools, resolveFilePath } from '../../tools';

/** Concatenates the text parts of a language model tool result. */
function text(result: vscode.LanguageModelToolResult): string {
	return result.content.map(part => (part as vscode.LanguageModelTextPart).value).join('');
}

function makeTools(context: any, refreshOss = () => {}, refreshWebhooks = () => {}): ApsLanguageModelTools {
	return new ApsLanguageModelTools({ environment: { title: 'Test', region: 'EMEA' }, ...context }, refreshOss, refreshWebhooks);
}

describe('ApsLanguageModelTools', () => {
	it('contributes every registered tool in package.json', async () => {
		const ext = vscode.extensions.getExtension('petrbroz.vscode-forge-tools');
		await ext!.activate();
		const contributed: string[] = ext!.packageJSON.contributes.languageModelTools.map((tool: any) => tool.name);
		const registered = vscode.lm.tools.map(tool => tool.name).filter(name => name.startsWith('aps_'));
		assert.deepStrictEqual([...registered].sort(), [...contributed].sort());
	});

	describe('listBuckets', () => {
		it('lists buckets of the current environment region', async () => {
			let region: string | undefined;
			const tools = makeTools({ ossService: { getAllBuckets: async (r: string) => { region = r; return [{ bucketKey: 'a', policyKey: 'transient', createdDate: 1, permissions: [] }]; } } });
			const result = JSON.parse(text(await tools.listBuckets()));
			assert.strictEqual(region, 'EMEA');
			assert.deepStrictEqual(result, [{ bucketKey: 'a', policyKey: 'transient', createdDate: 1 }]);
		});
	});

	describe('createBucket', () => {
		const retentionPolicies = ['transient', 'temporary', 'persistent'];

		it('creates a transient bucket by default and refreshes the OSS view', async () => {
			let args: any[] = [];
			let refreshed = false;
			const tools = makeTools({
				ossService: { retentionPolicies, createBucket: async (...a: any[]) => { args = a; return { bucketKey: a[1] }; } }
			}, () => { refreshed = true; });
			await tools.createBucket({ bucketKey: 'my-bucket' });
			assert.deepStrictEqual(args, ['EMEA', 'my-bucket', 'transient']);
			assert.strictEqual(refreshed, true);
		});

		it('rejects an unknown retention policy', async () => {
			const tools = makeTools({ ossService: { retentionPolicies, createBucket: async () => assert.fail('should not be called') } });
			await assert.rejects(tools.createBucket({ bucketKey: 'b', policyKey: 'forever' }), /Unknown retention policy/);
		});
	});

	describe('uploadFile', () => {
		it('uploads the file under its base name by default', async () => {
			let args: any[] = [];
			const filePath = path.resolve(__filename);
			const tools = makeTools({ ossService: { uploadObject: async (...a: any[]) => { args = a; return { objectKey: a[1] }; } } });
			await tools.uploadFile({ bucketKey: 'b', filePath });
			assert.deepStrictEqual(args, ['b', path.basename(filePath), filePath]);
		});

		it('rejects directories', async () => {
			const tools = makeTools({ ossService: { uploadObject: async () => assert.fail('should not be called') } });
			await assert.rejects(tools.uploadFile({ bucketKey: 'b', filePath: path.dirname(path.resolve(__filename)) }), /is a directory/);
		});
	});

	describe('resolveFilePath', () => {
		it('keeps absolute paths and resolves relative paths against the first workspace folder', () => {
			const absolute = path.resolve('/tmp/file.rvt');
			assert.strictEqual(resolveFilePath(absolute), absolute);
			const folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
			assert.strictEqual(resolveFilePath('models/file.rvt'), path.join(folder, 'models/file.rvt'));
		});
	});

	describe('translateObject', () => {
		it('starts an SVF2 translation of the object', async () => {
			const object = { objectId: 'urn:adsk.objects:os.object:b/model.rvt', objectKey: 'model.rvt' };
			let translated: any;
			const tools = makeTools({
				ossService: { getObjectDetails: async () => object },
				modelDerivativeService: {
					getSupportedOutputFormats: async () => ['svf', 'svf2'],
					translateToSvf2: async (o: any) => { translated = o; },
					getObjectUrn: () => 'dXJu'
				}
			});
			const result = JSON.parse(text(await tools.translateObject({ bucketKey: 'b', objectKey: 'model.rvt' })));
			assert.strictEqual(translated, object);
			assert.strictEqual(result.urn, 'dXJu');
		});

		it('rejects objects that cannot be translated to SVF2', async () => {
			const tools = makeTools({
				ossService: { getObjectDetails: async () => ({ objectId: 'id', objectKey: 'file.txt' }) },
				modelDerivativeService: { getSupportedOutputFormats: async () => [], translateToSvf2: async () => assert.fail('should not be called') }
			});
			await assert.rejects(tools.translateObject({ bucketKey: 'b', objectKey: 'file.txt' }), /does not support/);
		});
	});

	describe('getTranslationStatus', () => {
		it('summarizes the manifest', async () => {
			const tools = makeTools({
				ossService: { getObjectDetails: async () => ({ objectId: 'id', objectKey: 'model.rvt' }) },
				modelDerivativeService: {
					getObjectManifest: async () => ({ urn: 'dXJu', status: 'inprogress', progress: '50% complete', derivatives: [{ outputType: 'svf2', status: 'inprogress', progress: '50% complete', children: [] }] })
				}
			});
			const result = JSON.parse(text(await tools.getTranslationStatus({ bucketKey: 'b', objectKey: 'model.rvt' })));
			assert.deepStrictEqual(result, {
				urn: 'dXJu', status: 'inprogress', progress: '50% complete',
				derivatives: [{ outputType: 'svf2', status: 'inprogress', progress: '50% complete' }]
			});
		});
	});

	describe('listWebhookEvents', () => {
		it('lists the events of a single system', async () => {
			const result = JSON.parse(text(await makeTools({}).listWebhookEvents({ system: 'derivative' })));
			assert.strictEqual(result.length, 1);
			assert.ok(result[0].events.some((event: any) => event.id === 'extraction.finished'));
		});

		it('rejects an unknown system', async () => {
			await assert.rejects(makeTools({}).listWebhookEvents({ system: 'nope' }), /Unknown webhook system/);
		});
	});

	describe('createWebhook', () => {
		it('creates an app-context webhook using the event\'s default scope', async () => {
			let args: any[] = [];
			let refreshed = false;
			const tools = makeTools({
				webhooksServiceApp: { createWebhook: async (...a: any[]) => { args = a; } },
				webhooksServiceUser: { createWebhook: async () => assert.fail('should not be called') }
			}, undefined, () => { refreshed = true; });
			await tools.createWebhook({ system: 'data', event: 'dm.version.added', callbackUrl: 'https://example.com/hook', scopeValue: 'urn:folder' });
			assert.deepStrictEqual(args, ['data', 'dm.version.added', { callbackUrl: 'https://example.com/hook', scopeKey: 'folder', scopeValue: 'urn:folder', filter: undefined }]);
			assert.strictEqual(refreshed, true);
		});

		it('rejects unknown events and unsupported scopes', async () => {
			const tools = makeTools({ webhooksServiceApp: { createWebhook: async () => assert.fail('should not be called') } });
			await assert.rejects(tools.createWebhook({ system: 'data', event: 'nope', callbackUrl: 'u', scopeValue: 'v' }), /Unknown event/);
			await assert.rejects(tools.createWebhook({ system: 'data', event: 'dm.version.added', callbackUrl: 'u', scopeValue: 'v', scopeKey: 'project' }), /Unsupported scope/);
		});

		it('requires a session for user-context webhooks', async () => {
			const tools = makeTools({ webhooksServiceUser: { createWebhook: async () => assert.fail('should not be called') } });
			await assert.rejects(tools.createWebhook({ system: 'data', event: 'dm.version.added', callbackUrl: 'u', scopeValue: 'v', authContext: 'user' }), /requires signing in/);
		});
	});
});
