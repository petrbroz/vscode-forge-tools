import * as crypto from 'crypto';
import { AuthenticationClient, ResponseType, Scopes, ThreeLeggedToken } from '@aps_sdk/authentication';

/** Base64url-encodes a buffer (RFC 7636 / PKCE: no padding, URL-safe alphabet). */
function base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Scopes offered when generating access tokens and requested during the 3-legged login flow. */
const DefaultScopes: string[] = [
    Scopes.ViewablesRead,
    Scopes.CodeAll,
    Scopes.BucketCreate, Scopes.BucketRead, Scopes.BucketUpdate, Scopes.BucketDelete,
    Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.DataSearch,
    Scopes.AccountRead, Scopes.AccountWrite,
    Scopes.UserRead, Scopes.UserWrite,
    Scopes.UserProfileRead
]; // TODO: make the list configurable?

/**
 * Domain logic for Authentication. Wraps an `AuthenticationClient` and exposes plain, domain-shaped
 * operations (2-legged access tokens, and building/exchanging the 3-legged OAuth authorization code
 * grant) so the vscode layer never touches the SDK's client or enums. The vscode layer owns the actual
 * OAuth redirect (via `vscode.window.registerUriHandler`) and only calls in here to build the browser
 * URL and, once the redirect delivers a code, to exchange it for a token.
 */
export class AuthenticationService {
    constructor(
        private readonly client: AuthenticationClient,
        private readonly clientId: string,
        private readonly clientSecret: string
    ) {}

    /** Scopes offered when generating access tokens and requested during the 3-legged login flow. */
    get defaultScopes(): string[] {
        return DefaultScopes;
    }

    /** Generates a 2-legged (application) access token for the given scopes. */
    async getAccessToken(scopes: string[]): Promise<{ accessToken: string; expiresIn: number }> {
        const credentials = await this.client.getTwoLeggedToken(this.clientId, this.clientSecret, scopes as Scopes[]);
        return { accessToken: credentials.access_token!, expiresIn: credentials.expires_in! };
    }

    /** Generates a PKCE `code_verifier` and its S256 `code_challenge` for a public-client login. */
    createPkcePair(): { verifier: string; challenge: string } {
        const verifier = base64UrlEncode(crypto.randomBytes(32));
        const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
        return { verifier, challenge };
    }

    /**
     * Builds the browser URL that starts the 3-legged OAuth authorization code grant. `state` is
     * echoed back verbatim as a query parameter on the redirect, so the caller can correlate the
     * eventual callback with this request. Pass `codeChallenge` for a public (PKCE) client.
     */
    buildAuthorizationUrl(clientId: string, redirectUri: string, state: string, codeChallenge?: string): string {
        return this.client.authorize(clientId, ResponseType.Code, redirectUri, DefaultScopes as Scopes[], {
            state,
            ...(codeChallenge ? { codeChallenge, codeChallengeMethod: 'S256' } : {})
        });
    }

    /** Exchanges an authorization code for a user access token (confidential client, using the client secret). */
    exchangeAuthorizationCode(clientId: string, code: string, redirectUri: string): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        return this.exchangeCode(this.client.getThreeLeggedToken(clientId, code, redirectUri, { clientSecret: this.clientSecret }));
    }

    /** Exchanges an authorization code for a user access token using a PKCE `code_verifier` (public client). */
    exchangeAuthorizationCodeWithPkce(clientId: string, code: string, redirectUri: string, codeVerifier: string): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        return this.exchangeCode(this.client.getThreeLeggedToken(clientId, code, redirectUri, { code_verifier: codeVerifier }));
    }

    private async exchangeCode(request: Promise<ThreeLeggedToken>): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        const credentials = await request;
        if (!credentials.access_token || !credentials.expires_in) {
            throw new Error('Authentication data missing or incorrect.');
        }
        return { token: credentials.access_token, expiresIn: credentials.expires_in, refreshToken: credentials.refresh_token };
    }
}
