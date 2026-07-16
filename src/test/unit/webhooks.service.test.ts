import * as assert from 'assert';
import { WebhooksService } from '../../services/webhooks';

describe('WebhooksService', () => {
	describe('getAllSystemEventHooks', () => {
		it('follows the links.next page-state loop across pages', async () => {
			const seenPageStates: (string | undefined)[] = [];
			const fakeClient = {
				getSystemEventHooks: async (system: string, event: string, { pageState }: { pageState?: string }) => {
					assert.strictEqual(system, 'data');
					assert.strictEqual(event, 'dm.version.added');
					seenPageStates.push(pageState);
					if (pageState === undefined) {
						return { data: [{ hookId: 'hook-1' }], links: { next: 'cursor-1' } };
					}
					return { data: [{ hookId: 'hook-2' }], links: {} };
				}
			};

			const service = new WebhooksService(fakeClient as any);
			const hooks = await service.getAllSystemEventHooks('data', 'dm.version.added');

			assert.deepStrictEqual(hooks.map(h => (h as any).hookId), ['hook-1', 'hook-2']);
			assert.deepStrictEqual(seenPageStates, [undefined, 'cursor-1']);
		});
	});

	describe('getEventScopes', () => {
		it('returns the scopes of a known system/event from the catalog', () => {
			const service = new WebhooksService({} as any);
			assert.deepStrictEqual(service.getEventScopes('data', 'dm.version.added'), ['folder']);
		});

		it('throws for an unknown system id', () => {
			const service = new WebhooksService({} as any);
			assert.throws(() => service.getEventScopes('not-a-system', 'not-an-event'));
		});
	});

	describe('createWebhook', () => {
		it('shapes the scope map and omits falsy filter/hookAttribute', async () => {
			let received: any;
			const fakeClient = {
				createSystemEventHook: async (system: string, event: string, options: any) => {
					received = { system, event, options };
				}
			};

			const service = new WebhooksService(fakeClient as any);
			await service.createWebhook('data', 'dm.version.added', {
				callbackUrl: 'https://example.com/callback',
				scopeKey: 'folder',
				scopeValue: 'urn:adsk.wipprod:fs.folder:co.abc123'
			});

			assert.strictEqual(received.system, 'data');
			assert.strictEqual(received.event, 'dm.version.added');
			assert.strictEqual(received.options.callbackUrl, 'https://example.com/callback');
			assert.deepStrictEqual(received.options.scope, { folder: 'urn:adsk.wipprod:fs.folder:co.abc123' });
			assert.strictEqual(received.options.filter, undefined);
			assert.strictEqual(received.options.hookAttribute, undefined);
		});
	});

	describe('updateWebhook', () => {
		it('omits a falsy filter but forwards hookAttribute', async () => {
			let received: any;
			const fakeClient = {
				patchSystemEventHook: async (system: string, event: string, id: string, options: any) => {
					received = { system, event, id, options };
				}
			};

			const service = new WebhooksService(fakeClient as any);
			await service.updateWebhook('data', 'dm.version.added', 'hook-1', {
				filter: '',
				hookAttribute: { key: 'value' }
			});

			assert.strictEqual(received.id, 'hook-1');
			assert.strictEqual(received.options.filter, undefined);
			assert.deepStrictEqual(received.options.hookAttribute, { key: 'value' });
		});
	});
});
