import * as assert from 'assert';
import { TEAM_ADMIN_SCOPES, TeamAdminService } from '../../services/team-admin';
import { EntryType } from '../../models/team-admin';

interface IRecordedRequest {
	url: string;
	method?: string;
	body?: any;
	headers?: Record<string, string>;
}

const noHeaders = { forEach: () => {} };

function okResponse(data: any) {
	return { ok: true, status: 200, text: async () => data === undefined ? '' : JSON.stringify(data), headers: noHeaders };
}

describe('TeamAdminService', () => {
	const originalFetch = global.fetch;
	let requests: IRecordedRequest[];
	let requestedScopes: string[] | undefined;
	const authProvider = { getAccessToken: async (scopes?: string[]) => { requestedScopes = scopes; return 'user-token'; } };

	function mockFetch(handler: (url: string) => any) {
		global.fetch = (async (url: string, init: any) => {
			requests.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined, headers: init?.headers });
			return handler(url);
		}) as any;
	}

	beforeEach(() => {
		requests = [];
		requestedScopes = undefined;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe('getTeams', () => {
		it('follows the pagination cursor and maps teams to tree entries', async () => {
			mockFetch(url => url.includes('cursor=')
				? okResponse({ data: [{ id: 't2', name: 'Team 2' }], pagination: { cursor: null, hasMore: false } })
				: okResponse({ data: [{ id: 't1', name: 'Team 1' }], pagination: { cursor: 'c/1', hasMore: true } }));

			const service = new TeamAdminService(authProvider as any, 'https://example.com');
			const teams = await service.getTeams();

			assert.deepStrictEqual(teams, [
				{ type: EntryType.Team, id: 't1', name: 'Team 1' },
				{ type: EntryType.Team, id: 't2', name: 'Team 2' }
			]);
			assert.strictEqual(requests.length, 2);
			assert.strictEqual(requests[0].url, 'https://example.com/team-admin/v1/teams?limit=100');
			assert.strictEqual(requests[1].url, 'https://example.com/team-admin/v1/teams?limit=100&cursor=c%2F1');
			assert.strictEqual(requests[0].headers?.Authorization, 'Bearer user-token');
			assert.deepStrictEqual(requestedScopes, TEAM_ADMIN_SCOPES);
		});
	});

	describe('getUsers', () => {
		it('URL-encodes the team ID and builds display names', async () => {
			mockFetch(() => okResponse({
				data: [
					{ id: 'u1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'USER', isEmailVerified: true },
					{ id: 'u2', email: 'nameless@example.com', role: 'EXTERNAL_USER', isEmailVerified: false }
				],
				pagination: { cursor: null, hasMore: false }
			}));

			const service = new TeamAdminService(authProvider as any);
			const users = await service.getUsers('team/1');

			assert.strictEqual(requests[0].url, 'https://developer.api.autodesk.com/team-admin/v1/teams/team%2F1/users?limit=100');
			assert.strictEqual(users[0].name, 'Ada Lovelace');
			assert.strictEqual(users[1].name, 'nameless@example.com');
			assert.strictEqual(users[1].teamId, 'team/1');
		});
	});

	describe('getAssignments', () => {
		it('passes the filters as query parameters and tags direct assignments', async () => {
			mockFetch(() => okResponse({
				data: [
					{ userId: 'u1', email: 'a@example.com', teamId: 't1', productId: 'p1', productName: 'Product', assignmentType: 'DIRECT' },
					{ userId: 'u1', email: 'a@example.com', teamId: 't1', productId: 'p2', productName: null, assignmentType: 'GROUP' }
				]
			}));

			const service = new TeamAdminService(authProvider as any);
			const assignments = await service.getAssignments('t1', { userId: 'u1' });

			assert.strictEqual(requests[0].url, 'https://developer.api.autodesk.com/team-admin/v1/teams/t1/assignments?userId=u1');
			assert.strictEqual(assignments[0].type, EntryType.DirectAssignment);
			assert.strictEqual(assignments[1].type, EntryType.Assignment);
			assert.strictEqual(assignments[1].productName, 'p2');
		});
	});

	describe('assignProduct / unassignProduct', () => {
		it('POSTs a DIRECT assignment and DELETEs with query parameters', async () => {
			mockFetch(url => url.endsWith('/assignments')
				? okResponse({ userId: 'u1', email: 'a@example.com', teamId: 't1', productId: 'p1', productName: 'Product', assignmentType: 'DIRECT' })
				: { ok: true, status: 204, text: async () => '', headers: noHeaders });

			const service = new TeamAdminService(authProvider as any);
			await service.assignProduct('t1', 'u1', 'p1');
			await service.unassignProduct('t1', 'u1', 'p1');

			assert.strictEqual(requests[0].method, 'POST');
			assert.deepStrictEqual(requests[0].body, { userId: 'u1', productId: 'p1', assignmentType: 'DIRECT' });
			assert.strictEqual(requests[0].headers?.['Content-Type'], 'application/json');
			assert.strictEqual(requests[1].method, 'DELETE');
			assert.strictEqual(requests[1].url, 'https://developer.api.autodesk.com/team-admin/v1/teams/t1/assignments?userId=u1&productId=p1');
			assert.strictEqual(requests[1].body, undefined);
		});
	});

	describe('error handling', () => {
		it('throws a shaped error that includes the API message', async () => {
			global.fetch = (async () => ({
				ok: false,
				status: 422,
				statusText: 'Unprocessable Entity',
				text: async () => JSON.stringify({ message: 'No seats available' }),
				headers: { forEach: (cb: (value: string, key: string) => void) => cb('req-1', 'x-request-id') }
			})) as any;

			const service = new TeamAdminService(authProvider as any);
			await assert.rejects(
				() => service.assignProduct('t1', 'u1', 'p1'),
				(err: any) => {
					assert.strictEqual(err.message, 'Request failed with status code 422: No seats available');
					assert.strictEqual(err.response.status, 422);
					assert.deepStrictEqual(err.response.headers, { 'x-request-id': 'req-1' });
					return true;
				}
			);
		});
	});
});
