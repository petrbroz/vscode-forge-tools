import * as assert from 'assert';
import { DesignAutomationClient } from '../../services/design-automation';

const fakeAuthProvider = { getAccessToken: async () => 'fake-token' };

describe('DesignAutomationClient', () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe('getPaged (via listEngines)', () => {
		it('follows the paginationToken loop across pages and flattens the results', async () => {
			const requestedUrls: string[] = [];
			global.fetch = (async (url: string) => {
				requestedUrls.push(url);
				if (!url.includes('page=')) {
					return { ok: true, text: async () => JSON.stringify({ data: ['engine1'], paginationToken: 'cursor-1' }) };
				}
				assert.ok(url.includes('page=cursor-1'));
				return { ok: true, text: async () => JSON.stringify({ data: ['engine2'] }) };
			}) as any;

			const client = new DesignAutomationClient(fakeAuthProvider as any);
			const engines = await client.listEngines();

			assert.deepStrictEqual(engines, ['engine1', 'engine2']);
			assert.strictEqual(requestedUrls.length, 2);
		});
	});

	describe('getNickname', () => {
		it('falls back to the raw response text when it is not JSON', async () => {
			global.fetch = (async () => ({ ok: true, text: async () => 'my-nickname' })) as any;
			const client = new DesignAutomationClient(fakeAuthProvider as any);
			assert.strictEqual(await client.getNickname(), 'my-nickname');
		});
	});

	describe('error handling', () => {
		it('throws a shaped error on a non-ok response', async () => {
			global.fetch = (async () => ({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
				text: async () => JSON.stringify({ message: 'nope' }),
				headers: { forEach: (cb: (value: string, key: string) => void) => cb('text/plain', 'content-type') }
			})) as any;

			const client = new DesignAutomationClient(fakeAuthProvider as any);
			await assert.rejects(
				() => client.getNickname(),
				(err: any) => {
					assert.strictEqual(err.response.status, 403);
					assert.deepStrictEqual(err.response.data, { message: 'nope' });
					assert.deepStrictEqual(err.response.headers, { 'content-type': 'text/plain' });
					return true;
				}
			);
		});
	});
});
