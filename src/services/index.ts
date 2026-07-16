import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { OssClient } from '@aps_sdk/oss';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { WebhooksClient } from '@aps_sdk/webhooks';
import { DataManagementClient } from '@aps_sdk/data-management';
import { IEnvironment } from '../models/environment';
import { createApsSdkManager } from './aps-sdk-manager';
import { ClientCredentialsAuthenticationProvider } from './client-credentials-authentication-provider';
import { StaticTokenAuthenticationProvider } from './static-token-authentication-provider';
import { createSecureServiceAccountsClient, SecureServiceAccountsService } from './secure-service-accounts';
import { createDesignAutomationClient, DesignAutomationService } from './design-automation';
import { OssService } from './oss';
import { AuthenticationService } from './authentication';
import { ModelDerivativeService } from './model-derivative';
import { HubsService } from './hubs';
import { WebhooksService } from './webhooks';

const OSS_SCOPES: string[] = [Scopes.BucketCreate, Scopes.BucketRead, Scopes.BucketUpdate, Scopes.BucketDelete, Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const MODEL_DERIVATIVE_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.ViewablesRead];
const WEBHOOKS_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const DATA_MANAGEMENT_SCOPES: string[] = [Scopes.DataRead];

export interface IServices {
    authenticationService: AuthenticationService;
    ossService: OssService;
    modelDerivativeService: ModelDerivativeService;
    designAutomationService: DesignAutomationService;
    webhooksService: WebhooksService;
    hubsService: HubsService; // hubs/projects/folders/items/versions, used by the Hubs view
    secureServiceAccountsService: SecureServiceAccountsService;
}

/**
 * Builds every API client the extension needs from a single environment (and, optionally, the
 * current 3-legged access token). This is the one place client construction happens - switching
 * environments and logging in/out both just call this again and replace the old clients, rather
 * than mutating existing client instances in place.
 */
export function createServices(env: IEnvironment, threeLeggedToken?: string): IServices {
    const sdkManager = createApsSdkManager(env.host);
    // The Hubs view's Data Management client and `modelDerivativeClient3L` need to run in a user
    // context; fall back to the 2-legged provider when no 3-legged token is available yet.
    const userAuthenticationProvider = threeLeggedToken
        ? new StaticTokenAuthenticationProvider(threeLeggedToken)
        : new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, DATA_MANAGEMENT_SCOPES, env.host);

    const authenticationClient = new AuthenticationClient({ sdkManager });
    const modelDerivativeClient2L = new ModelDerivativeClient({
        sdkManager,
        authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, MODEL_DERIVATIVE_SCOPES, env.host)
    });
    const modelDerivativeClient3L = new ModelDerivativeClient({ sdkManager, authenticationProvider: userAuthenticationProvider });

    const modelDerivativeService = new ModelDerivativeService(modelDerivativeClient2L, modelDerivativeClient3L, authenticationClient, env.clientId, env.clientSecret, threeLeggedToken);
    const dataManagementClient = new DataManagementClient({ sdkManager, authenticationProvider: userAuthenticationProvider });

    return {
        authenticationService: new AuthenticationService(authenticationClient, env.clientId, env.clientSecret),
        ossService: new OssService(new OssClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, OSS_SCOPES, env.host)
        })),
        modelDerivativeService,
        designAutomationService: new DesignAutomationService(createDesignAutomationClient(env)),
        webhooksService: new WebhooksService(new WebhooksClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, WEBHOOKS_SCOPES, env.host)
        })),
        hubsService: new HubsService(dataManagementClient, modelDerivativeService),
        secureServiceAccountsService: new SecureServiceAccountsService(createSecureServiceAccountsClient(env))
    };
}
