import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { SecureServiceAccountsService } from './secure-service-accounts';

/**
 * User-context authentication provider backed by a Secure Service Account (SSA). Mints an access token
 * on behalf of the service account by signing a JWT assertion with its private key and exchanging it,
 * then caches the token until it is about to expire. Delegates the actual SSA operations to
 * {@link SecureServiceAccountsService} so all `@aps_sdk/secure-service-account` usage stays in one place.
 */
export class ServiceAccountAuthenticationProvider implements IAuthenticationProvider {
    private cached?: { token: string; expiresAt: number };

    constructor(
        private readonly secureServiceAccountsService: SecureServiceAccountsService,
        private readonly clientId: string,
        private readonly clientSecret: string,
        private readonly serviceAccountId: string,
        private readonly keyId: string,
        private readonly privateKey: string,
        private readonly scopes: string[]
    ) {}

    async getAccessToken(scopes?: string[]): Promise<string> {
        const requestedScopes = scopes ?? this.scopes;
        // 60s skew so a token that's about to expire is re-minted before it's used.
        if (this.cached && Date.now() < this.cached.expiresAt - 60_000) {
            return this.cached.token;
        }
        const assertion = this.secureServiceAccountsService.generateJwtAssertion(this.clientId, this.serviceAccountId, this.privateKey, this.keyId, requestedScopes);
        const exchanged = await this.secureServiceAccountsService.exchangeJwtAssertion(assertion, this.clientId, this.clientSecret, requestedScopes);
        this.cached = { token: exchanged.access_token!, expiresAt: Date.now() + (exchanged.expires_in ?? 3600) * 1000 };
        return this.cached.token;
    }
}
