import * as assert from 'assert';
import { UserTokenAuthenticationProvider } from '../../services/user-token-authentication-provider';

describe('UserTokenAuthenticationProvider', () => {
	describe('getAccessToken', () => {
		it('returns the cached access token when it is well within its expiry', async () => {
			const fakeClient = {
				refreshToken: async () => { throw new Error('should not be called'); }
			};
			const provider = new UserTokenAuthenticationProvider(fakeClient as any, 'client-id', {
				accessToken: 'cached-token',
				refreshToken: 'refresh-1',
				expiresAt: Date.now() + 5 * 60 * 1000
			});

			assert.strictEqual(await provider.getAccessToken(), 'cached-token');
		});

		it('refreshes the token once it is within the 60s expiry skew', async () => {
			let received: any;
			const fakeClient = {
				refreshToken: async (refreshToken: string, clientId: string, options: any) => {
					received = { refreshToken, clientId, options };
					return { access_token: 'new-token', expires_in: 3600, refresh_token: 'refresh-2' };
				}
			};
			const provider = new UserTokenAuthenticationProvider(fakeClient as any, 'client-id', {
				accessToken: 'stale-token',
				refreshToken: 'refresh-1',
				expiresAt: Date.now() + 10_000 // within the 60s skew window
			}, 'client-secret');

			const token = await provider.getAccessToken();

			assert.strictEqual(token, 'new-token');
			assert.strictEqual(received.refreshToken, 'refresh-1');
			assert.strictEqual(received.clientId, 'client-id');
			assert.strictEqual(received.options.clientSecret, 'client-secret');
		});

		it('carries the old refresh token forward when the SDK response omits a new one', async () => {
			let reportedMaterial: any;
			const fakeClient = {
				refreshToken: async () => ({ access_token: 'new-token', expires_in: 3600 })
			};
			const provider = new UserTokenAuthenticationProvider(fakeClient as any, 'client-id', {
				accessToken: 'stale-token',
				refreshToken: 'refresh-1',
				expiresAt: Date.now() - 1000
			}, undefined, material => { reportedMaterial = material; });

			await provider.getAccessToken();

			assert.strictEqual(reportedMaterial.accessToken, 'new-token');
			assert.strictEqual(reportedMaterial.refreshToken, 'refresh-1');
			assert.ok(reportedMaterial.expiresAt > Date.now());
		});

		it('returns the stale access token without refreshing when there is no refresh token', async () => {
			const fakeClient = {
				refreshToken: async () => { throw new Error('should not be called'); }
			};
			const provider = new UserTokenAuthenticationProvider(fakeClient as any, 'client-id', {
				accessToken: 'stale-token',
				expiresAt: Date.now() - 1000
			});

			assert.strictEqual(await provider.getAccessToken(), 'stale-token');
		});

		it('invokes onRefresh with the newly minted material', async () => {
			const refreshCalls: any[] = [];
			const fakeClient = {
				refreshToken: async () => ({ access_token: 'new-token', expires_in: 1800, refresh_token: 'refresh-2' })
			};
			const provider = new UserTokenAuthenticationProvider(fakeClient as any, 'client-id', {
				accessToken: 'stale-token',
				refreshToken: 'refresh-1',
				expiresAt: Date.now() - 1000
			}, undefined, material => refreshCalls.push(material));

			await provider.getAccessToken();

			assert.strictEqual(refreshCalls.length, 1);
			assert.deepStrictEqual(refreshCalls[0].accessToken, 'new-token');
			assert.deepStrictEqual(refreshCalls[0].refreshToken, 'refresh-2');
		});
	});
});
