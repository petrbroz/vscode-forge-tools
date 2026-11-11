import * as assert from 'assert';
import { ClientCredentialsAuthenticationProvider } from '../../services/client-credentials-authentication-provider';

/** Replaces the provider's internal SDK client with a stub that counts token requests. */
function stub(provider: ClientCredentialsAuthenticationProvider, expiresIn: number, fail = false) {
	const calls: string[][] = [];
	(provider as any).authenticationClient = {
		getTwoLeggedToken: async (_id: string, _secret: string, scopes: string[]) => {
			calls.push(scopes);
			if (fail) {
				throw new Error('boom');
			}
			return { access_token: `token-${calls.length}`, expires_in: expiresIn };
		}
	};
	return calls;
}

describe('ClientCredentialsAuthenticationProvider', () => {
	it('reuses a cached token for the same scopes, regardless of order', async () => {
		const provider = new ClientCredentialsAuthenticationProvider('id', 'secret', ['data:read', 'data:write']);
		const calls = stub(provider, 3600);
		assert.strictEqual(await provider.getAccessToken(), 'token-1');
		assert.strictEqual(await provider.getAccessToken(['data:write', 'data:read']), 'token-1');
		assert.strictEqual(calls.length, 1);
	});

	it('shares a single request between concurrent callers', async () => {
		const provider = new ClientCredentialsAuthenticationProvider('id', 'secret', ['data:read']);
		const calls = stub(provider, 3600);
		const tokens = await Promise.all([provider.getAccessToken(), provider.getAccessToken(), provider.getAccessToken()]);
		assert.deepStrictEqual(tokens, ['token-1', 'token-1', 'token-1']);
		assert.strictEqual(calls.length, 1);
	});

	it('requests separate tokens for different scopes', async () => {
		const provider = new ClientCredentialsAuthenticationProvider('id', 'secret', ['data:read']);
		const calls = stub(provider, 3600);
		await provider.getAccessToken();
		await provider.getAccessToken(['code:all']);
		assert.strictEqual(calls.length, 2);
	});

	it('requests a new token when the cached one is about to expire', async () => {
		const provider = new ClientCredentialsAuthenticationProvider('id', 'secret', ['data:read']);
		const calls = stub(provider, 30); // within the 60s expiry skew
		assert.strictEqual(await provider.getAccessToken(), 'token-1');
		assert.strictEqual(await provider.getAccessToken(), 'token-2');
		assert.strictEqual(calls.length, 2);
	});

	it('does not cache failed requests', async () => {
		const provider = new ClientCredentialsAuthenticationProvider('id', 'secret', ['data:read']);
		stub(provider, 3600, true);
		await assert.rejects(provider.getAccessToken(), /boom/);
		const calls = stub(provider, 3600);
		assert.strictEqual(await provider.getAccessToken(), 'token-1');
		assert.strictEqual(calls.length, 1);
	});
});
