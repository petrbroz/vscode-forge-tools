import * as assert from 'assert';
import { AuthenticationService } from '../../services/authentication';

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

	describe('createPkcePair', () => {
		it('generates a code_verifier and a matching S256 code_challenge', () => {
			const service = new AuthenticationService({} as any, 'app-client-id', 'app-client-secret');
			const { verifier, challenge } = service.createPkcePair();

			// A SHA-256/base64url code_verifier: 32 random bytes, unpadded base64url is 43 chars.
			assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
			assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
			assert.notStrictEqual(verifier, challenge);
		});
	});

	describe('buildAuthorizationUrl', () => {
		it('delegates to the SDK client with a code response type, the default scopes and the given state', () => {
			let received: any;
			const fakeClient = {
				authorize: (clientId: string, responseType: string, redirectUri: string, scopes: string[], optionalArgs: any) => {
					received = { clientId, responseType, redirectUri, scopes, optionalArgs };
					return 'https://developer.api.autodesk.com/authentication/v2/authorize?...';
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const url = service.buildAuthorizationUrl('3l-client-id', 'vscode://publisher.name/callback', 'state-1');

			assert.strictEqual(url, 'https://developer.api.autodesk.com/authentication/v2/authorize?...');
			assert.strictEqual(received.clientId, '3l-client-id');
			assert.strictEqual(received.responseType, 'code');
			assert.strictEqual(received.redirectUri, 'vscode://publisher.name/callback');
			assert.deepStrictEqual(received.scopes, service.defaultScopes);
			assert.strictEqual(received.optionalArgs.state, 'state-1');
			assert.strictEqual(received.optionalArgs.codeChallenge, undefined);
			assert.strictEqual(received.optionalArgs.codeChallengeMethod, undefined);
		});

		it('includes the PKCE code_challenge parameters when a codeChallenge is given', () => {
			let received: any;
			const fakeClient = {
				authorize: (clientId: string, responseType: string, redirectUri: string, scopes: string[], optionalArgs: any) => {
					received = optionalArgs;
					return 'url';
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			service.buildAuthorizationUrl('3l-client-id', 'vscode://publisher.name/callback', 'state-1', 'challenge-1');

			assert.strictEqual(received.codeChallenge, 'challenge-1');
			assert.strictEqual(received.codeChallengeMethod, 'S256');
		});
	});

	describe('exchangeAuthorizationCode (confidential 3-legged client)', () => {
		it('exchanges the code for a token using the client secret', async () => {
			let received: any;
			const fakeClient = {
				getThreeLeggedToken: async (clientId: string, code: string, redirectUri: string, options: any) => {
					received = { clientId, code, redirectUri, options };
					return { access_token: 'user-token', expires_in: 3600, refresh_token: 'refresh-1' };
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const result = await service.exchangeAuthorizationCode('3l-client-id', 'auth-code-1', 'vscode://publisher.name/callback');

			assert.deepStrictEqual(result, { token: 'user-token', expiresIn: 3600, refreshToken: 'refresh-1' });
			assert.strictEqual(received.clientId, '3l-client-id');
			assert.strictEqual(received.code, 'auth-code-1');
			assert.strictEqual(received.redirectUri, 'vscode://publisher.name/callback');
			assert.strictEqual(received.options.clientSecret, 'app-client-secret');
		});

		it('rejects when the exchanged credentials are missing an access token', async () => {
			const fakeClient = { getThreeLeggedToken: async () => ({}) };
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			await assert.rejects(
				() => service.exchangeAuthorizationCode('3l-client-id', 'auth-code-1', 'vscode://publisher.name/callback'),
				/Authentication data missing or incorrect/
			);
		});
	});

	describe('exchangeAuthorizationCodeWithPkce (public 3-legged client)', () => {
		it('exchanges the code with a PKCE code_verifier instead of a client secret', async () => {
			let received: any;
			const fakeClient = {
				getThreeLeggedToken: async (clientId: string, code: string, redirectUri: string, options: any) => {
					received = { clientId, code, redirectUri, options };
					return { access_token: 'user-token', expires_in: 3600, refresh_token: 'refresh-1' };
				}
			};
			const service = new AuthenticationService(fakeClient as any, 'app-client-id', 'app-client-secret');

			const result = await service.exchangeAuthorizationCodeWithPkce('3l-client-id', 'auth-code-1', 'vscode://publisher.name/callback', 'verifier-1');

			assert.deepStrictEqual(result, { token: 'user-token', expiresIn: 3600, refreshToken: 'refresh-1' });
			assert.strictEqual(received.options.clientSecret, undefined);
			assert.strictEqual(received.options.code_verifier, 'verifier-1');
		});
	});
});
