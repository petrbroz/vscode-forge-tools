import * as assert from 'assert';
import { AuthenticationService } from '../../services/authentication';

/** Retries `fetch` until the just-started local callback server is actually accepting connections. */
async function fetchWithRetry(url: string, init?: RequestInit, attempts = 100): Promise<Response> {
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fetch(url, init);
		} catch (err) {
			lastErr = err;
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}
	throw lastErr;
}

describe('AuthenticationService', () => {
	describe('getAccessToken', () => {
		it('maps the 2-legged token response to {accessToken, expiresIn}', async () => {
			const fakeClient = {
				getTwoLeggedToken: async (clientId: string, clientSecret: string, scopes: string[]) => {
					assert.strictEqual(clientId, 'app-client-id');
					assert.strictEqual(clientSecret, 'app-client-secret');
					assert.deepStrictEqual(scopes, ['data:read']);
					return { access_token: 'app-token', expires_in: 3600 };
				}
			};

			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');
			const result = await service.getAccessToken(['data:read']);

			assert.deepStrictEqual(result, { accessToken: 'app-token', expiresIn: 3600 });
		});
	});

	describe('login (confidential 3-legged client)', () => {
		const PORT = 18391;

		it('resolves with the exchanged token once the callback delivers a code', async () => {
			let received: any;
			const fakeClient = {
				getThreeLeggedToken: async (clientId: string, code: string, redirectUri: string, options: any) => {
					received = { clientId, code, redirectUri, options };
					return { access_token: 'user-token', expires_in: 3600, refresh_token: 'refresh-1' };
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.login('3l-client-id', PORT, () => {});
			const response = await fetchWithRetry(`http://localhost:${PORT}/auth/callback?code=auth-code-1`);
			assert.strictEqual(response.status, 200);

			const result = await loginPromise;

			assert.deepStrictEqual(result, { token: 'user-token', expiresIn: 3600, refreshToken: 'refresh-1' });
			assert.strictEqual(received.clientId, '3l-client-id');
			assert.strictEqual(received.code, 'auth-code-1');
			assert.strictEqual(received.redirectUri, `http://localhost:${PORT}/auth/callback`);
			assert.strictEqual(received.options.clientSecret, 'app-client-secret');
		});

		it('invokes onListening with the local callback URL', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({ access_token: 't', expires_in: 3600 }) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			let listeningUrl: string | undefined;
			const loginPromise = service.login('3l-client-id', PORT + 1, url => { listeningUrl = url; });
			await fetchWithRetry(`http://localhost:${PORT + 1}/auth/callback?code=auth-code-1`);
			await loginPromise;

			assert.strictEqual(listeningUrl, `http://localhost:${PORT + 1}`);
		});

		it('rejects when the user cancels the login', async () => {
			const fakeClient = { getThreeLeggedToken: async () => { throw new Error('should not be called'); } };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.login('3l-client-id', PORT + 2, () => {});
			const response = await fetchWithRetry(`http://localhost:${PORT + 2}/auth/cancel`);
			assert.strictEqual(response.status, 200);

			await assert.rejects(() => loginPromise, /Cancelled by user/);
		});

		it('rejects when the exchanged credentials are missing an access token', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({}) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.login('3l-client-id', PORT + 3, () => {});
			await fetchWithRetry(`http://localhost:${PORT + 3}/auth/callback?code=auth-code-1`);

			await assert.rejects(() => loginPromise, /Authentication data missing or incorrect/);
		});

		it('responds 404 for unrecognized paths without settling the login promise', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({ access_token: 't', expires_in: 3600 }) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.login('3l-client-id', PORT + 4, () => {});
			const response = await fetchWithRetry(`http://localhost:${PORT + 4}/not-a-real-path`);
			assert.strictEqual(response.status, 404);

			// Clean up the still-open server/pending promise so it doesn't linger past this test.
			await fetchWithRetry(`http://localhost:${PORT + 4}/auth/cancel`);
			await assert.rejects(() => loginPromise, /Cancelled by user/);
		});

		it('serves a login page with no PKCE code_challenge for the confidential-client flow', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({ access_token: 't', expires_in: 3600 }) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.login('3l-client-id', PORT + 5, () => {});
			const page = await (await fetchWithRetry(`http://localhost:${PORT + 5}/`)).text();
			assert.ok(!page.includes('code_challenge'));

			await fetchWithRetry(`http://localhost:${PORT + 5}/auth/cancel`);
			await assert.rejects(() => loginPromise, /Cancelled by user/);
		});
	});

	describe('loginWithPkce (public 3-legged client)', () => {
		const PORT = 18401;

		it('exchanges the code with a PKCE code_verifier instead of a client secret', async () => {
			let received: any;
			const fakeClient = {
				getThreeLeggedToken: async (clientId: string, code: string, redirectUri: string, options: any) => {
					received = { clientId, code, redirectUri, options };
					return { access_token: 'user-token', expires_in: 3600, refresh_token: 'refresh-1' };
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.loginWithPkce('3l-client-id', PORT, () => {});
			await fetchWithRetry(`http://localhost:${PORT}/auth/callback?code=auth-code-1`);
			const result = await loginPromise;

			assert.deepStrictEqual(result, { token: 'user-token', expiresIn: 3600, refreshToken: 'refresh-1' });
			assert.strictEqual(received.options.clientSecret, undefined);
			// A SHA-256/base64url code_verifier: 32 random bytes, unpadded base64url is 43 chars.
			assert.match(received.options.code_verifier, /^[A-Za-z0-9_-]{43}$/);
		});

		it('serves a login page including the PKCE code_challenge parameters', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({ access_token: 't', expires_in: 3600 }) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const loginPromise = service.loginWithPkce('3l-client-id', PORT + 1, () => {});
			const page = await (await fetchWithRetry(`http://localhost:${PORT + 1}/`)).text();
			assert.ok(page.includes('code_challenge'));
			assert.ok(page.includes('code_challenge_method'));

			await fetchWithRetry(`http://localhost:${PORT + 1}/auth/cancel`);
			await assert.rejects(() => loginPromise, /Cancelled by user/);
		});
	});
});
