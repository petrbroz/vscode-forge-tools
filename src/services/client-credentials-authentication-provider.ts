import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { createApsSdkManager } from './aps-sdk-manager';

/**
 * Client-credentials (2-legged) authentication provider for the `@aps_sdk/*` client family.
 * Not specific to any one service, so future `@aps_sdk/*` clients can reuse it instead of
 * each rolling their own token acquisition.
 */
export class ClientCredentialsAuthenticationProvider implements IAuthenticationProvider {
    private readonly authenticationClient: AuthenticationClient;

    constructor(
        private readonly clientId: string,
        private readonly clientSecret: string,
        private readonly scopes: string[],
        host?: string
    ) {
        this.authenticationClient = new AuthenticationClient({ sdkManager: createApsSdkManager(host) });
    }

    async getAccessToken(scopes?: string[]): Promise<string> {
        // Cast needed because @aps_sdk/authentication's `Scopes` enum doesn't (yet) include every
        // scope in use across APS, e.g. Secure Service Accounts' `application:service_account:*`.
        const token = await this.authenticationClient.getTwoLeggedToken(this.clientId, this.clientSecret, (scopes ?? this.scopes) as Scopes[]);
        return token.access_token;
    }
}
