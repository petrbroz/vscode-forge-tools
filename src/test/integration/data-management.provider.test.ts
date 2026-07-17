import * as assert from 'assert';
import * as vscode from 'vscode';
import { SimpleStorageDataProvider } from '../../providers/data-management';

function makeProvider(ossService: any = {}, modelDerivativeService: any = {}): SimpleStorageDataProvider {
	return new SimpleStorageDataProvider({ ossService, modelDerivativeService } as any);
}

describe('SimpleStorageDataProvider', () => {
	describe('getChildren (root - buckets)', () => {
		it('lists buckets sorted by bucketKey, with a trailing "load more" entry when a next page remains', async () => {
			const provider = makeProvider({
				getBucketsPage: async () => ({
					items: [{ bucketKey: 'zeta', policyKey: 'transient' }, { bucketKey: 'alpha', policyKey: 'transient' }],
					nextStartAt: 'cursor-1'
				})
			});

			const children = await provider.getChildren();

			assert.deepStrictEqual(children.map((c: any) => c.bucketKey ?? c), [
				'alpha', 'zeta', { loadMore: true, parentKey: SimpleStorageDataProvider.rootKey }
			]);
		});

		it('omits the "load more" entry when there is no next page', async () => {
			const provider = makeProvider({ getBucketsPage: async () => ({ items: [{ bucketKey: 'alpha', policyKey: 'transient' }] }) });
			const children = await provider.getChildren();
			assert.strictEqual(children.length, 1);
		});

		it('fetches only once and reuses the cache on a second getChildren() call', async () => {
			let calls = 0;
			const provider = makeProvider({ getBucketsPage: async () => { calls++; return { items: [{ bucketKey: 'alpha', policyKey: 'transient' }] }; } });

			await provider.getChildren();
			await provider.getChildren();

			assert.strictEqual(calls, 1);
		});

		it('recovers from a fetch error by showing no children (and not throwing)', async () => {
			const originalShowErrorMessage = vscode.window.showErrorMessage;
			(vscode.window as any).showErrorMessage = async () => undefined;
			try {
				const provider = makeProvider({ getBucketsPage: async () => { throw new Error('network blip'); } });
				assert.deepStrictEqual(await provider.getChildren(), []);
			} finally {
				(vscode.window as any).showErrorMessage = originalShowErrorMessage;
			}
		});
	});

	describe('loadMore', () => {
		it('fetches the next page, appends it to the cache, and fires a change event', async () => {
			let call = 0;
			const provider = makeProvider({
				getBucketsPage: async ({ startAt }: { startAt?: string }) => {
					call++;
					if (startAt === undefined) {
						return { items: [{ bucketKey: 'alpha', policyKey: 'transient' }], nextStartAt: 'cursor-1' };
					}
					assert.strictEqual(startAt, 'cursor-1');
					return { items: [{ bucketKey: 'beta', policyKey: 'transient' }] };
				}
			});
			const fired: any[] = [];
			provider.onDidChangeTreeData!(e => fired.push(e));

			await provider.getChildren(); // primes the cache with page 1 + a "load more" entry
			await provider.loadMore(SimpleStorageDataProvider.rootKey);
			const children = await provider.getChildren(); // no further fetch - served from cache

			assert.strictEqual(call, 2);
			assert.deepStrictEqual(children.map((c: any) => c.bucketKey), ['alpha', 'beta']);
			assert.deepStrictEqual(fired, [null]);
		});

		it('does nothing when there is no next page to load', async () => {
			let calls = 0;
			const provider = makeProvider({ getBucketsPage: async () => { calls++; return { items: [] }; } });

			await provider.getChildren();
			await provider.loadMore(SimpleStorageDataProvider.rootKey);

			assert.strictEqual(calls, 1);
		});
	});

	describe('getChildren (bucket - objects)', () => {
		it('lists a bucket\'s objects sorted by objectKey, forwarding the active filter', async () => {
			let receivedOptions: any;
			const provider = makeProvider({
				getObjectsPage: async (bucketKey: string, options: any) => {
					receivedOptions = { bucketKey, ...options };
					return { items: [{ objectKey: 'b.txt', objectId: 'id-b' }, { objectKey: 'a.txt', objectId: 'id-a' }] };
				}
			});
			provider.setFilter('my-bucket', 'a');

			const children = await provider.getChildren({ bucketKey: 'my-bucket', policyKey: 'transient' } as any);

			assert.deepStrictEqual(children.map((c: any) => c.objectKey), ['a.txt', 'b.txt']);
			assert.strictEqual(receivedOptions.bucketKey, 'my-bucket');
			assert.strictEqual(receivedOptions.beginsWith, 'a');
		});
	});

	describe('getChildren (object - derivatives)', () => {
		const object = { objectId: 'urn:adsk.objects:os.object:my-bucket/model.rvt', objectKey: 'model.rvt' };

		it('returns the sorted derivatives when the manifest translation succeeded', async () => {
			const provider = makeProvider({}, {
				getManifest: async () => ({ status: 'success' }),
				getManifestDerivatives: async () => [{ name: 'ViewB', guid: 'g2' }, { name: 'ViewA', guid: 'g1' }]
			});

			const children = await provider.getChildren(object as any);

			assert.deepStrictEqual(children.map((c: any) => c.name), ['ViewA', 'ViewB']);
		});

		it('returns a failure hint (with the failure message in the tooltip) when the translation failed', async () => {
			const provider = makeProvider({}, {
				getManifest: async () => ({
					status: 'failed',
					derivatives: [{ status: 'failed', messages: [{ code: 'BadFile', message: 'Corrupted source file' }] }]
				})
			});

			const children: any[] = await provider.getChildren(object as any);

			assert.strictEqual(children.length, 1);
			assert.ok(children[0].hint.includes('Translation failed'));
			assert.ok(children[0].tooltip.includes('Corrupted source file'));
		});

		it('returns a progress hint while the translation is still running', async () => {
			const provider = makeProvider({}, {
				getManifest: async () => ({ status: 'inprogress', progress: '50%' })
			});

			const children: any[] = await provider.getChildren(object as any);

			assert.strictEqual(children.length, 1);
			assert.ok(children[0].hint.includes('50%'));
		});

		it('returns a "no derivatives yet" hint when fetching the manifest fails', async () => {
			const provider = makeProvider({}, { getManifest: async () => { throw new Error('not found'); } });
			const children: any[] = await provider.getChildren(object as any);

			assert.strictEqual(children.length, 1);
			assert.ok(children[0].hint.includes('No derivatives yet'));
		});
	});

	describe('setFilter / getFilter', () => {
		it('is unset by default, and round-trips through setFilter', () => {
			const provider = makeProvider();
			assert.strictEqual(provider.getFilter('my-bucket'), undefined);

			provider.setFilter('my-bucket', 'prefix');
			assert.strictEqual(provider.getFilter('my-bucket'), 'prefix');

			provider.setFilter('my-bucket', undefined);
			assert.strictEqual(provider.getFilter('my-bucket'), undefined);
		});

		it('fires a full refresh when the bucket list has not been loaded yet', () => {
			const provider = makeProvider();
			const fired: any[] = [];
			provider.onDidChangeTreeData!(e => fired.push(e));

			provider.setFilter('my-bucket', 'prefix');

			assert.deepStrictEqual(fired, [null]);
		});

		it('fires a change for just the affected bucket once the bucket list is loaded', async () => {
			const bucket = { bucketKey: 'my-bucket', policyKey: 'transient' };
			const provider = makeProvider({ getBucketsPage: async () => ({ items: [bucket] }) });
			await provider.getChildren(); // loads the root bucket list into the cache

			const fired: any[] = [];
			provider.onDidChangeTreeData!(e => fired.push(e));
			provider.setFilter('my-bucket', 'prefix');

			assert.deepStrictEqual(fired, [bucket]);
		});
	});

	describe('getTreeItem', () => {
		const provider = makeProvider();

		it('renders a bucket node', () => {
			const node = provider.getTreeItem({ bucketKey: 'my-bucket', policyKey: 'transient' } as any) as vscode.TreeItem;
			assert.strictEqual(node.label, 'my-bucket');
			assert.strictEqual(node.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
			assert.strictEqual(node.contextValue, 'bucket');
			assert.strictEqual((node.iconPath as vscode.ThemeIcon).id, 'folder');
			assert.strictEqual(node.description, undefined);
		});

		it('renders a filtered bucket node with a description and contextValue reflecting the filter', () => {
			const filteredProvider = makeProvider();
			filteredProvider.setFilter('my-bucket', 'prefix');
			const node = filteredProvider.getTreeItem({ bucketKey: 'my-bucket', policyKey: 'transient' } as any) as vscode.TreeItem;
			assert.strictEqual(node.description, 'filter: prefix');
			assert.strictEqual(node.contextValue, 'bucket-filtered');
			assert.ok((node.tooltip as string).includes('Filter: prefix'));
		});

		it('renders an object node', () => {
			const node = provider.getTreeItem({ objectId: 'id-1', objectKey: 'model.rvt', size: 1024 } as any) as vscode.TreeItem;
			assert.strictEqual(node.label, 'model.rvt');
			assert.strictEqual(node.contextValue, 'object');
			assert.strictEqual((node.iconPath as vscode.ThemeIcon).id, 'file');
			assert.ok((node.tooltip as string).includes('Size: 1024 bytes'));
		});

		it('renders a viewable derivative node', () => {
			const node = provider.getTreeItem({ name: 'View1', format: 'svf2', role: '3d', guid: 'g1' } as any) as vscode.TreeItem;
			assert.strictEqual(node.label, 'View1');
			assert.strictEqual(node.contextValue, 'derivative');
			assert.strictEqual(node.collapsibleState, vscode.TreeItemCollapsibleState.None);
		});

		it('renders a non-viewable derivative node with a distinct contextValue', () => {
			const node = provider.getTreeItem({ name: 'model.obj', format: 'obj', role: 'obj', guid: 'g1', nonViewable: true } as any) as vscode.TreeItem;
			assert.strictEqual(node.contextValue, 'non-viewable-derivative');
		});

		it('renders a "load more" node wired to the aps.oss.loadMore command', () => {
			const node = provider.getTreeItem({ loadMore: true, parentKey: 'my-bucket' } as any) as vscode.TreeItem;
			assert.strictEqual(node.label, 'Load more…');
			assert.strictEqual(node.contextValue, 'load-more');
			assert.deepStrictEqual(node.command, { command: 'aps.oss.loadMore', title: 'Load more', arguments: ['my-bucket'] });
		});

		it('renders a hint node using its hint text as the description', () => {
			const node = provider.getTreeItem({ hint: 'No derivatives yet', tooltip: 'Try again later' } as any) as vscode.TreeItem;
			assert.strictEqual(node.label, '');
			assert.strictEqual(node.description, 'No derivatives yet');
			assert.strictEqual(node.tooltip, 'Try again later');
			assert.strictEqual(node.contextValue, 'hint');
		});
	});
});
