import * as assert from 'assert';
import { ServiceAccountAuthenticationProvider } from '../../services/service-account-authentication-provider';

describe('ServiceAccountAuthenticationProvider', () => {
	describe('getAccessToken', () => {
		it('mints a token via generateJwtAssertion + exchangeJwtAssertion using the default scopes', async () => {
			let generateArgs: any;
			let exchangeArgs: any;
			const fakeSsaService = {
				generateJwtAssertion: (clientId: string, accountId: string, privateKey: string, keyId: string, scopes: string[]) => {
					generateArgs = { clientId, accountId, privateKey, keyId, scopes };
					return 'signed-assertion';
				},
				exchangeJwtAssertion: async (assertion: string, clientId: string, clientSecret: string, scopes: string[]) => {
					exchangeArgs = { assertion, clientId, clientSecret, scopes };
					return { access_token: 'ssa-token', expires_in: 3600 };
				}
			};

			const provider = new ServiceAccountAuthenticationProvider(
				fakeSsaService as any, 'client-id', 'client-secret', 'account-1', 'key-1', 'private-key-pem', ['data:read']
			);

			const token = await provider.getAccessToken();

			assert.strictEqual(token, 'ssa-token');
			assert.deepStrictEqual(generateArgs, { clientId: 'client-id', accountId: 'account-1', privateKey: 'private-key-pem', keyId: 'key-1', scopes: ['data:read'] });
			assert.strictEqual(exchangeArgs.assertion, 'signed-assertion');
			assert.strictEqual(exchangeArgs.clientSecret, 'client-secret');
			assert.deepStrictEqual(exchangeArgs.scopes, ['data:read']);
		});

		it('reuses the cached token on a second call within the 60s expiry skew', async () => {
			let exchangeCalls = 0;
			const fakeSsaService = {
				generateJwtAssertion: () => 'signed-assertion',
				exchangeJwtAssertion: async () => {
					exchangeCalls++;
					return { access_token: 'ssa-token', expires_in: 3600 };
				}
			};
			const provider = new ServiceAccountAuthenticationProvider(
				fakeSsaService as any, 'client-id', 'client-secret', 'account-1', 'key-1', 'private-key-pem', ['data:read']
			);

			await provider.getAccessToken();
			await provider.getAccessToken();

			assert.strictEqual(exchangeCalls, 1);
		});

		it('re-mints once the cached token is within the expiry skew', async () => {
			let exchangeCalls = 0;
			const fakeSsaService = {
				generateJwtAssertion: () => 'signed-assertion',
				exchangeJwtAssertion: async () => {
					exchangeCalls++;
					// expires_in: 0 puts the cached expiry at Date.now(), already inside the 60s skew.
					return { access_token: `ssa-token-${exchangeCalls}`, expires_in: 0 };
				}
			};
			const provider = new ServiceAccountAuthenticationProvider(
				fakeSsaService as any, 'client-id', 'client-secret', 'account-1', 'key-1', 'private-key-pem', ['data:read']
			);

			const first = await provider.getAccessToken();
			const second = await provider.getAccessToken();

			assert.strictEqual(first, 'ssa-token-1');
			assert.strictEqual(second, 'ssa-token-2');
			assert.strictEqual(exchangeCalls, 2);
		});

		it('forwards a per-call scope override instead of the constructor default scopes', async () => {
			let usedScopes: string[] | undefined;
			const fakeSsaService = {
				generateJwtAssertion: (_clientId: string, _accountId: string, _privateKey: string, _keyId: string, scopes: string[]) => {
					usedScopes = scopes;
					return 'signed-assertion';
				},
				exchangeJwtAssertion: async () => ({ access_token: 'ssa-token', expires_in: 3600 })
			};
			const provider = new ServiceAccountAuthenticationProvider(
				fakeSsaService as any, 'client-id', 'client-secret', 'account-1', 'key-1', 'private-key-pem', ['data:read']
			);

			await provider.getAccessToken(['account:read']);

			assert.deepStrictEqual(usedScopes, ['account:read']);
		});
	});
});
