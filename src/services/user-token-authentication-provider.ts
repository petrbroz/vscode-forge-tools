import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient } from '@aps_sdk/authentication';

/** Cached user-token material; `expiresAt` is epoch ms. */
export interface IUserTokenMaterial {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
}

/**
 * User-context (3-legged) authentication provider for the `@aps_sdk/*` client family, covering both the
 * authorization-code (confidential client, with `clientSecret`) and PKCE (public client, no secret)
 * flows. Unlike the fixed {@link StaticTokenAuthenticationProvider}, this one refreshes the token via
 * the SDK's refresh grant when it is about to expire, and reports the new material through `onRefresh`
 * so the vscode layer can re-persist it to secret storage.
 */
export class UserTokenAuthenticationProvider implements IAuthenticationProvider {
    constructor(
        private readonly authenticationClient: AuthenticationClient,
        private readonly clientId: string,
        private material: IUserTokenMaterial,
        private readonly clientSecret?: string,
        private readonly onRefresh?: (material: IUserTokenMaterial) => void
    ) {}

    async getAccessToken(): Promise<string> {
        // 60s skew so a token that's about to expire is refreshed before it's used.
        if (this.material.accessToken && Date.now() < this.material.expiresAt - 60_000) {
            return this.material.accessToken;
        }
        if (this.material.refreshToken) {
            const credentials = await this.authenticationClient.refreshToken(this.material.refreshToken, this.clientId, {
                clientSecret: this.clientSecret
            });
            this.material = {
                accessToken: credentials.access_token!,
                refreshToken: credentials.refresh_token ?? this.material.refreshToken,
                expiresAt: Date.now() + credentials.expires_in! * 1000
            };
            this.onRefresh?.(this.material);
        }
        return this.material.accessToken;
    }
}
