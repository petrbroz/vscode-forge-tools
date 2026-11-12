import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { createApsSdkManager } from './aps-sdk-manager';

/** Re-request a cached token this long before it actually expires. */
const ExpirySkewMs = 60_000;

/**
 * Client-credentials (2-legged) authentication provider for the `@aps_sdk/*` client family.
 * Not specific to any one service, so future `@aps_sdk/*` clients can reuse it instead of
 * each rolling their own token acquisition. Tokens are cached per scope set until shortly
 * before they expire.
 */
export class ClientCredentialsAuthenticationProvider implements IAuthenticationProvider {
    private readonly authenticationClient: AuthenticationClient;
    private readonly cache = new Map<string, Promise<{ token: string; expiresAt: number }>>();

    constructor(
        private readonly clientId: string,
        private readonly clientSecret: string,
        private readonly scopes: string[],
        host?: string
    ) {
        this.authenticationClient = new AuthenticationClient({ sdkManager: createApsSdkManager(host) });
    }

    async getAccessToken(scopes?: string[]): Promise<string> {
        const requestedScopes = scopes ?? this.scopes;
        const key = [...requestedScopes].sort().join(' ');
        let entry = this.cache.get(key);
        if (entry) {
            try {
                const { token, expiresAt } = await entry;
                if (Date.now() < expiresAt - ExpirySkewMs) {
                    return token;
                }
            } catch {
                // A previously failed request; fall through and retry.
            }
        }
        // Cache the in-flight promise so concurrent callers share a single token request.
        entry = this.fetchToken(requestedScopes);
        this.cache.set(key, entry);
        try {
            return (await entry).token;
        } catch (err) {
            this.cache.delete(key);
            throw err;
        }
    }

    private async fetchToken(scopes: string[]): Promise<{ token: string; expiresAt: number }> {
        // Cast needed because @aps_sdk/authentication's `Scopes` enum doesn't (yet) include every
        // scope in use across APS, e.g. Secure Service Accounts' `application:service_account:*`.
        const credentials = await this.authenticationClient.getTwoLeggedToken(this.clientId, this.clientSecret, scopes as Scopes[]);
        return { token: credentials.access_token, expiresAt: Date.now() + (credentials.expires_in ?? 3600) * 1000 };
    }
}
