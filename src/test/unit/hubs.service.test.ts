import * as assert from 'assert';
import { HubsService } from '../../services/hubs';

describe('HubsService', () => {
	describe('getHubs', () => {
		it('falls back to <no name> when a hub has no name attribute', async () => {
			const fakeClient = {
				getHubs: async () => ({
					data: [
						{ id: 'hub-1', attributes: { name: 'My Hub' } },
						{ id: 'hub-2', attributes: {} }
					]
				})
			};

			const service = new HubsService(fakeClient as any, {} as any);
			const hubs = await service.getHubs();

			assert.deepStrictEqual(hubs, [
				{ kind: 'hub', id: 'hub-1', name: 'My Hub' },
				{ kind: 'hub', id: 'hub-2', name: '<no name>' }
			]);
		});
	});

	describe('getTopFolders', () => {
		it('prefixes hidden folders with "(hidden) "', async () => {
			const fakeClient = {
				getProjectTopFolders: async () => ({
					data: [
						{ id: 'folder-1', attributes: { name: 'Visible', hidden: false } },
						{ id: 'folder-2', attributes: { name: 'Secret', hidden: true } }
					]
				})
			};

			const service = new HubsService(fakeClient as any, {} as any);
			const folders = await service.getTopFolders('hub-1', 'project-1');

			assert.deepStrictEqual(folders.map(f => f.name), ['Visible', '(hidden) Secret']);
		});
	});

	describe('getFolderContents', () => {
		it('maps folders and items to their respective view models', async () => {
			const fakeClient = {
				getFolderContents: async () => ({
					data: [
						{ type: 'folders', id: 'folder-1', attributes: { name: 'Sub Folder' } },
						{ type: 'items', id: 'item-1', attributes: { displayName: 'File.txt' } }
					]
				})
			};

			const service = new HubsService(fakeClient as any, {} as any);
			const contents = await service.getFolderContents('project-1', 'folder-0');

			assert.deepStrictEqual(contents, [
				{ kind: 'folder', projectId: 'project-1', id: 'folder-1', name: 'Sub Folder' },
				{ kind: 'item', projectId: 'project-1', id: 'item-1', name: 'File.txt' }
			]);
		});

		it('throws on an unexpected item type', async () => {
			const fakeClient = {
				getFolderContents: async () => ({ data: [{ type: 'something-else', id: 'x', attributes: {} }] })
			};

			const service = new HubsService(fakeClient as any, {} as any);
			await assert.rejects(() => service.getFolderContents('project-1', 'folder-0'));
		});

		it('follows the links.next -> page[number] continuation loop across pages', async () => {
			const seenPageNumbers: (number | undefined)[] = [];
			const fakeClient = {
				getFolderContents: async (_projectId: string, _folderId: string, { pageNumber }: { pageNumber?: number }) => {
					seenPageNumbers.push(pageNumber);
					if (pageNumber === undefined) {
						return {
							data: [{ type: 'items', id: 'item-1', attributes: { displayName: 'a.txt' } }],
							links: { next: { href: 'https://x/api?page%5Bnumber%5D=1' } }
						};
					}
					assert.strictEqual(pageNumber, 1);
					return {
						data: [{ type: 'items', id: 'item-2', attributes: { displayName: 'b.txt' } }],
						links: {}
					};
				}
			};

			const service = new HubsService(fakeClient as any, {} as any);
			const contents = await service.getFolderContents('project-1', 'folder-0');

			assert.deepStrictEqual(contents.map(c => c.id), ['item-1', 'item-2']);
			assert.deepStrictEqual(seenPageNumbers, [undefined, 1]);
		});
	});

	describe('version derivative delegation', () => {
		it('delegates getVersionManifest and getVersionDerivatives to the injected ModelDerivativeService', async () => {
			const manifest = { status: 'success' };
			const calls: string[] = [];
			const fakeModelDerivativeService = {
				getVersionManifest: async (versionId: string) => {
					calls.push(`getVersionManifest:${versionId}`);
					return manifest;
				},
				getVersionDerivatives: async (versionId: string, m?: unknown) => {
					calls.push(`getVersionDerivatives:${versionId}:${m === manifest}`);
					return [];
				}
			};

			const service = new HubsService({} as any, fakeModelDerivativeService as any);

			assert.strictEqual(await service.getVersionManifest('version-1'), manifest);
			assert.deepStrictEqual(await service.getVersionDerivatives('version-1', manifest as any), []);
			assert.deepStrictEqual(calls, ['getVersionManifest:version-1', 'getVersionDerivatives:version-1:true']);
		});
	});
});
