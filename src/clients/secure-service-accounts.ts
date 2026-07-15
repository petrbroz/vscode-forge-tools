import { SecureServiceAccountClient, Scopes } from '@aps_sdk/secure-service-account';
import { IEnvironment } from '../environment';
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
