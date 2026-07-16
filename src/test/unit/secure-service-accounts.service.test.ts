import * as assert from 'assert';
import { EntryType } from '../../models/secure-service-accounts';
import { SecureServiceAccountsService } from '../../services/secure-service-accounts';

describe('SecureServiceAccountsService', () => {
	describe('getServiceAccounts', () => {
		it('maps SDK service accounts to view models', async () => {
			const fakeClient = {
				getServiceAccounts: async () => ({
					serviceAccounts: [{ serviceAccountId: 'account-1', email: 'account-1@example.com' }]
				})
			};

			const service = new SecureServiceAccountsService(fakeClient as any);
			const accounts = await service.getServiceAccounts();

			assert.deepStrictEqual(accounts, [
				{ type: EntryType.SecureServiceAccount, id: 'account-1', email: 'account-1@example.com' }
			]);
		});

		it('returns an empty array when the SDK response has no service accounts', async () => {
			const fakeClient = { getServiceAccounts: async () => ({}) };
			const service = new SecureServiceAccountsService(fakeClient as any);
			assert.deepStrictEqual(await service.getServiceAccounts(), []);
		});
	});

	describe('getServiceAccountKeys', () => {
		it('maps SDK keys to view models tagged with the owning account id', async () => {
			const fakeClient = {
				getAllServiceAccountKeys: async () => ({ keys: [{ kid: 'key-1', status: 'ACTIVE' }] })
			};

			const service = new SecureServiceAccountsService(fakeClient as any);
			const keys = await service.getServiceAccountKeys('account-1');

			assert.deepStrictEqual(keys, [
				{ type: EntryType.SecureServiceAccountKey, id: 'key-1', status: 'ACTIVE', secureServiceAccountId: 'account-1' }
			]);
		});
	});

	describe('createServiceAccount', () => {
		it('returns the new account email', async () => {
			const fakeClient = { createServiceAccount: async () => ({ email: 'new@example.com' }) };
			const service = new SecureServiceAccountsService(fakeClient as any);
			assert.strictEqual(await service.createServiceAccount('name', 'first', 'last'), 'new@example.com');
		});

		it('returns undefined when the SDK response has no account', async () => {
			const fakeClient = { createServiceAccount: async () => undefined };
			const service = new SecureServiceAccountsService(fakeClient as any);
			assert.strictEqual(await service.createServiceAccount('name', 'first', 'last'), undefined);
		});
	});

	describe('getServiceAccountKeyDetails', () => {
		it('finds a key by kid among the account keys', async () => {
			const keyDetails = { kid: 'key-2', status: 'ACTIVE' };
			const fakeClient = {
				getAllServiceAccountKeys: async () => ({ keys: [{ kid: 'key-1' }, keyDetails] })
			};

			const service = new SecureServiceAccountsService(fakeClient as any);
			assert.strictEqual(await service.getServiceAccountKeyDetails('account-1', 'key-2'), keyDetails);
		});

		it('returns undefined when no key matches', async () => {
			const fakeClient = { getAllServiceAccountKeys: async () => ({ keys: [{ kid: 'key-1' }] }) };
			const service = new SecureServiceAccountsService(fakeClient as any);
			assert.strictEqual(await service.getServiceAccountKeyDetails('account-1', 'missing'), undefined);
		});
	});
});
