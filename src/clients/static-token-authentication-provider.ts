import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';

/**
 * Static-token (3-legged) authentication provider for the `@aps_sdk/*` client family. Returns a
 * fixed access token (e.g. the user token obtained during 3-legged login) regardless of the
 * requested scopes. Used for clients that must run in a user context - the Hubs view's Data
 * Management client and `modelDerivativeClient3L`.
 */
export class StaticTokenAuthenticationProvider implements IAuthenticationProvider {
    constructor(private readonly accessToken: string) {}

    async getAccessToken(): Promise<string> {
        return this.accessToken;
    }
}
