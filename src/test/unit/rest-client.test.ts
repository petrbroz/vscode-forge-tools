import * as assert from 'assert';
import { cursorPaging, PAGINATION_TOKEN_PAGING, RestClient } from '../../services/rest-client';

describe('RestClient', () => {
	const originalFetch = global.fetch;
	let requestedScopes: string[] | undefined;
	const authProvider = { getAccessToken: async (scopes?: string[]) => { requestedScopes = scopes; return 'fake-token'; } };

	afterEach(() => {
		global.fetch = originalFetch;
		requestedScopes = undefined;
	});

	describe('request', () => {
		it('sends the bearer token for the configured scopes and a JSON body', async () => {
			let init: any;
			let requestedUrl: string | undefined;
			global.fetch = (async (url: string, i: any) => {
				requestedUrl = url;
				init = i;
				return { ok: true, text: async () => JSON.stringify({ id: 1 }) };
			}) as any;

			const client = new RestClient('https://example.com/api', authProvider as any, ['scope:a']);
			const result = await client.request<any>({ method: 'POST', url: '/things', data: { name: 'x' } });

			assert.deepStrictEqual(result, { id: 1 });
			assert.strictEqual(requestedUrl, 'https://example.com/api/things');
			assert.deepStrictEqual(requestedScopes, ['scope:a']);
			assert.strictEqual(init.headers['Authorization'], ['Bearer', 'fake-token'].join(' '));
			assert.strictEqual(init.headers['Content-Type'], 'application/json');
			assert.strictEqual(init.body, JSON.stringify({ name: 'x' }));
		});

		it('falls back to the raw response text when it is not JSON', async () => {
			global.fetch = (async () => ({ ok: true, text: async () => 'plain' })) as any;
			const client = new RestClient('https://example.com', authProvider as any, []);
			assert.strictEqual(await client.request<string>({ method: 'GET', url: '/me' }), 'plain');
		});

		it('throws an axios-shaped error on a non-ok response', async () => {
			global.fetch = (async () => ({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
				text: async () => JSON.stringify({ message: 'nope' }),
				headers: { forEach: (cb: (value: string, key: string) => void) => cb('text/plain', 'content-type') }
			})) as any;

			const client = new RestClient('https://example.com', authProvider as any, []);
			await assert.rejects(
				() => client.request({ method: 'GET', url: '/me' }),
				(err: any) => {
					assert.strictEqual(err.message, 'Request failed with status code 403: nope');
					assert.strictEqual(err.response.status, 403);
					assert.deepStrictEqual(err.response.data, { message: 'nope' });
					assert.deepStrictEqual(err.response.headers, { 'content-type': 'text/plain' });
					return true;
				}
			);
		});
	});

	describe('getAllPages', () => {
		it('follows a paginationToken chain', async () => {
			const urls: string[] = [];
			global.fetch = (async (url: string) => {
				urls.push(url);
				return { ok: true, text: async () => JSON.stringify(url.includes('page=') ? { data: [2] } : { data: [1], paginationToken: 'a b' }) };
			}) as any;

			const client = new RestClient('https://example.com', authProvider as any, []);
			assert.deepStrictEqual(await client.getAllPages<number>('/items', PAGINATION_TOKEN_PAGING), [1, 2]);
			assert.deepStrictEqual(urls, ['https://example.com/items', 'https://example.com/items?page=a+b']);
		});

		it('follows a cursor chain, keeping the query and limit on every page', async () => {
			const urls: string[] = [];
			global.fetch = (async (url: string) => {
				urls.push(url);
				return { ok: true, text: async () => JSON.stringify(url.includes('cursor=')
					? { data: [2], pagination: { cursor: null, hasMore: false } }
					: { data: [1], pagination: { cursor: 'c1', hasMore: true } }) };
			}) as any;

			const client = new RestClient('https://example.com', authProvider as any, []);
			const items = await client.getAllPages<number>('/items', cursorPaging(50), { teamId: 't' });
			assert.deepStrictEqual(items, [1, 2]);
			assert.deepStrictEqual(urls, [
				'https://example.com/items?teamId=t&limit=50',
				'https://example.com/items?teamId=t&limit=50&cursor=c1'
			]);
		});
	});
});
