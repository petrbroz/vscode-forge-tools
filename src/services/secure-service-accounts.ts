import { SecureServiceAccountClient, Scopes, Utils, ServiceAccountDetails, ServiceAccountKeyDetails, ExchangeJwtToken } from '@aps_sdk/secure-service-account';
import { IEnvironment } from '../models/environment';
import { EntryType, ISecureServiceAccount, ISecureServiceAccountKey } from '../models/secure-service-accounts';
import { ClientCredentialsAuthenticationProvider } from './client-credentials-authentication-provider';
import { createApsSdkManager } from './aps-sdk-manager';

export const SecureServiceAccountScopes: Scopes[] = [
    Scopes.ApplicationServiceAccountRead,
    Scopes.ApplicationServiceAccountWrite,
    Scopes.ApplicationServiceAccountKeyRead,
    Scopes.ApplicationServiceAccountKeyWrite
];

export function createSecureServiceAccountsClient(env: IEnvironment): SecureServiceAccountClient {
    return new SecureServiceAccountClient({
        authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, SecureServiceAccountScopes, env.host),
        sdkManager: createApsSdkManager(env.host)
    });
}

/**
 * Domain logic for Secure Service Accounts (SSA). Wraps a `SecureServiceAccountClient` and exposes
 * plain, domain-shaped operations so the vscode layers never touch the SDK's client, enums, or
 * response shapes. Owns all `@aps_sdk/secure-service-account` usage (including `Scopes` and the
 * `Utils` JWT helper); callers pass scopes as plain strings.
 */
export class SecureServiceAccountsService {
    constructor(private readonly client: SecureServiceAccountClient) {}

    /** Lists all service accounts owned by the application, mapped to view models. */
    async getServiceAccounts(): Promise<ISecureServiceAccount[]> {
        const response = await this.client.getServiceAccounts();
        return (response?.serviceAccounts || []).map(account => ({
            type: EntryType.SecureServiceAccount,
            id: account.serviceAccountId!,
            email: account.email!,
        }));
    }

    /** Lists all keys of a service account, mapped to view models. */
    async getServiceAccountKeys(accountId: string): Promise<ISecureServiceAccountKey[]> {
        const response = await this.client.getAllServiceAccountKeys(accountId);
        return (response?.keys || []).map(key => ({
            type: EntryType.SecureServiceAccountKey,
            id: key.kid!,
            status: key.status!,
            secureServiceAccountId: accountId,
        }));
    }

    /** Creates a new service account; returns the new account's e-mail address. */
    async createServiceAccount(name: string, firstName: string, lastName: string): Promise<string | undefined> {
        const account = await this.client.createServiceAccount({ name, firstName, lastName });
        return account?.email ?? undefined;
    }

    getServiceAccountDetails(accountId: string): Promise<ServiceAccountDetails> {
        return this.client.getServiceAccount(accountId);
    }

    async enableServiceAccount(accountId: string): Promise<void> {
        await this.client.enableServiceAccount(accountId);
    }

    async disableServiceAccount(accountId: string): Promise<void> {
        await this.client.disableServiceAccount(accountId);
    }

    async deleteServiceAccount(accountId: string): Promise<void> {
        await this.client.deleteServiceAccount(accountId);
    }

    /** Creates a new key for a service account; returns the private key (shown only once). */
    async createServiceAccountKey(accountId: string): Promise<string | undefined> {
        const key = await this.client.createServiceAccountKey(accountId);
        return key?.privateKey ?? undefined;
    }

    /** Retrieves the details of a single key by looking it up among the account's keys. */
    async getServiceAccountKeyDetails(accountId: string, keyId: string): Promise<ServiceAccountKeyDetails | undefined> {
        const response = await this.client.getAllServiceAccountKeys(accountId);
        return response?.keys?.find(key => key.kid === keyId);
    }

    async enableServiceAccountKey(accountId: string, keyId: string): Promise<void> {
        await this.client.enableServiceAccountKey(accountId, keyId);
    }

    async disableServiceAccountKey(accountId: string, keyId: string): Promise<void> {
        await this.client.disableServiceAccountKey(accountId, keyId);
    }

    async deleteServiceAccountKey(accountId: string, keyId: string): Promise<void> {
        await this.client.deleteServiceAccountKey(accountId, keyId);
    }

    /** Generates a signed JWT assertion for a service account key. */
    generateJwtAssertion(clientId: string, accountId: string, privateKey: string, keyId: string, scopes: string[]): string {
        return Utils.generateJwtAssertion(clientId, accountId, privateKey, keyId, scopes as Scopes[]);
    }

    /** Exchanges a JWT assertion for an access token. */
    exchangeJwtAssertion(assertion: string, clientId: string, clientSecret: string, scopes: string[]): Promise<ExchangeJwtToken> {
        return this.client.exchangeJwtAssertion(assertion, clientId, clientSecret, { scope: scopes as Scopes[] });
    }
}
