import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { OssClient } from '@aps_sdk/oss';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { WebhooksClient } from '@aps_sdk/webhooks';
import { DataManagementClient } from '@aps_sdk/data-management';
import { IssuesClient } from '@aps_sdk/construction-issues';
import { AdminClient } from '@aps_sdk/construction-account-admin';
import { IEnvironment } from '../models/environment';
import { IApsAuthSession } from '../models/authentication';
import { createApsSdkManager } from './aps-sdk-manager';
import { ClientCredentialsAuthenticationProvider } from './client-credentials-authentication-provider';
import { StaticTokenAuthenticationProvider } from './static-token-authentication-provider';
import { UserTokenAuthenticationProvider } from './user-token-authentication-provider';
import { ServiceAccountAuthenticationProvider } from './service-account-authentication-provider';
import { createSecureServiceAccountsClient, SecureServiceAccountsService } from './secure-service-accounts';
import { createDesignAutomationClient, DesignAutomationService } from './design-automation';
import { OssService } from './oss';
import { AuthenticationService } from './authentication';
import { ModelDerivativeService } from './model-derivative';
import { HubsService } from './hubs';
import { WebhooksService } from './webhooks';
import { IssuesService } from './issues';
import { HubAdminService } from './hub-admin';

const OSS_SCOPES: string[] = [Scopes.BucketCreate, Scopes.BucketRead, Scopes.BucketUpdate, Scopes.BucketDelete, Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const MODEL_DERIVATIVE_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.ViewablesRead];
const WEBHOOKS_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const DATA_MANAGEMENT_SCOPES: string[] = [Scopes.DataRead];
const VIEWER_SCOPES: string[] = [Scopes.ViewablesRead];
const HUB_ADMIN_SCOPES: string[] = [Scopes.AccountRead];

export interface IServices {
    authenticationService: AuthenticationService;
    ossService: OssService;
    modelDerivativeService: ModelDerivativeService;
    designAutomationService: DesignAutomationService;
    webhooksServiceApp: WebhooksService;  // Webhooks (app) view - app-owned hooks (2-legged)
    webhooksServiceUser: WebhooksService; // Webhooks (user) view - user-owned hooks (active session)
    hubsService: HubsService; // hubs/projects/folders/items/versions, used by the Data & Derivatives (user) view
    hubsServiceApp: HubsService; // hub listing (2-legged), used to seed the Hub Admin (app) view's tree roots
    issuesService: IssuesService; // ACC/BIM 360 issues, used by the Issues (user) view (user context only)
    secureServiceAccountsService: SecureServiceAccountsService;
    hubAdminServiceApp: HubAdminService;  // Hub Admin (app) view - account/project/company data (2-legged)
    hubAdminServiceUser: HubAdminService; // Hub Admin (user) view - account/project/company data (active session)
}

/**
 * Builds the user-context `IAuthenticationProvider` for a persisted session, picking the implementation
 * that matches the session's sign-in mode. Kept in the services layer so the vscode layers never touch
 * `@aps_sdk/*`. `onRefresh` (for the 3-legged/PKCE modes) lets the caller re-persist token material when
 * it is refreshed.
 */
export function createSessionAuthenticationProvider(
    env: IEnvironment,
    session: IApsAuthSession,
    onRefresh?: (session: IApsAuthSession) => void
): IAuthenticationProvider {
    const sdkManager = createApsSdkManager(env.host);
    switch (session.mode.kind) {
        case 'manual-token':
            return new StaticTokenAuthenticationProvider(session.accessToken);
        case 'authorization-code':
        case 'authorization-code-pkce': {
            const authenticationClient = new AuthenticationClient({ sdkManager });
            const clientSecret = session.mode.kind === 'authorization-code' ? env.clientSecret : undefined;
            return new UserTokenAuthenticationProvider(
                authenticationClient,
                env.clientId,
                { accessToken: session.accessToken, refreshToken: session.refreshToken, expiresAt: session.expiresAt },
                clientSecret,
                onRefresh
                    ? (material) => onRefresh({ ...session, accessToken: material.accessToken, refreshToken: material.refreshToken, expiresAt: material.expiresAt })
                    : undefined
            );
        }
        case 'service-account':
            return new ServiceAccountAuthenticationProvider(
                new SecureServiceAccountsService(createSecureServiceAccountsClient(env)),
                env.clientId,
                env.clientSecret,
                session.mode.serviceAccountId,
                session.mode.keyId,
                session.mode.privateKey,
                session.scopes
            );
    }
}

/**
 * Builds every API client the extension needs from a single environment and, optionally, the active
 * user-context authentication provider (from {@link createSessionAuthenticationProvider}). This is the
 * one place client construction happens - switching environments and signing in/out both just call this
 * again and replace the old clients, rather than mutating existing client instances in place.
 *
 * Services whose APIs are "App only" (OSS, Design Automation, Secure Service Account management, and the
 * app-context Webhooks/Model Derivative surfaces) always use a 2-legged provider. Services whose APIs are
 * "User context required/optional" in a user surface (the Hubs Data Management client, the user-context
 * Webhooks client, and the Model Derivative user client) use `userProvider`; when no session is active
 * they fall back to a 2-legged provider, but the corresponding views are gated behind sign-in.
 */
export function createServices(env: IEnvironment, userProvider?: IAuthenticationProvider): IServices {
    const sdkManager = createApsSdkManager(env.host);
    const user = userProvider
        ?? new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, DATA_MANAGEMENT_SCOPES, env.host);

    const authenticationClient = new AuthenticationClient({ sdkManager });
    const modelDerivativeClientApp = new ModelDerivativeClient({
        sdkManager,
        authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, MODEL_DERIVATIVE_SCOPES, env.host)
    });
    const modelDerivativeClientUser = new ModelDerivativeClient({ sdkManager, authenticationProvider: user });
    const appViewerProvider = new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, VIEWER_SCOPES, env.host);
    const modelDerivativeService = new ModelDerivativeService(modelDerivativeClientApp, modelDerivativeClientUser, appViewerProvider, user);
    const dataManagementClient = new DataManagementClient({ sdkManager, authenticationProvider: user });
    const dataManagementClientApp = new DataManagementClient({
        sdkManager,
        authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, DATA_MANAGEMENT_SCOPES, env.host)
    });
    const issuesClient = new IssuesClient({ sdkManager, authenticationProvider: user });

    return {
        authenticationService: new AuthenticationService(authenticationClient, env.clientId, env.clientSecret),
        ossService: new OssService(new OssClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, OSS_SCOPES, env.host)
        })),
        modelDerivativeService,
        designAutomationService: new DesignAutomationService(createDesignAutomationClient(env)),
        webhooksServiceApp: new WebhooksService(new WebhooksClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, WEBHOOKS_SCOPES, env.host)
        })),
        webhooksServiceUser: new WebhooksService(new WebhooksClient({ sdkManager, authenticationProvider: user })),
        hubsService: new HubsService(dataManagementClient, modelDerivativeService),
        hubsServiceApp: new HubsService(dataManagementClientApp, modelDerivativeService),
        issuesService: new IssuesService(issuesClient),
        secureServiceAccountsService: new SecureServiceAccountsService(createSecureServiceAccountsClient(env)),
        hubAdminServiceApp: new HubAdminService(new AdminClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, HUB_ADMIN_SCOPES, env.host)
        })),
        hubAdminServiceUser: new HubAdminService(new AdminClient({ sdkManager, authenticationProvider: user }))
    };
}
