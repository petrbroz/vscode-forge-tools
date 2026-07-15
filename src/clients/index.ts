import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { OssClient } from '@aps_sdk/oss';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { WebhooksClient } from '@aps_sdk/webhooks';
import { DataManagementClient } from '@aps_sdk/data-management';
import { SecureServiceAccountClient } from '@aps_sdk/secure-service-account';
import { IEnvironment } from '../environment';
import { createApsSdkManager } from './aps-sdk-manager';
import { ClientCredentialsAuthenticationProvider } from './client-credentials-authentication-provider';
import { StaticTokenAuthenticationProvider } from './static-token-authentication-provider';
import { createSecureServiceAccountsClient } from './secure-service-accounts';
import { createDesignAutomationClient, DesignAutomationClient } from './design-automation';

const OSS_SCOPES: string[] = [Scopes.BucketCreate, Scopes.BucketRead, Scopes.BucketUpdate, Scopes.BucketDelete, Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const MODEL_DERIVATIVE_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.ViewablesRead];
const WEBHOOKS_SCOPES: string[] = [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate];
const DATA_MANAGEMENT_SCOPES: string[] = [Scopes.DataRead];

export interface IClients {
    clientId: string;
    clientSecret: string;
    authenticationClient: AuthenticationClient;
    dataManagementClient: OssClient;
    modelDerivativeClient2L: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L: ModelDerivativeClient; // client for 3-legged workflows
    designAutomationClient: DesignAutomationClient;
    webhookClient: WebhooksClient;
    bim360Client: DataManagementClient; // hubs/projects/folders/items/versions, used by the Hubs view
    secureServiceAccountsClient: SecureServiceAccountClient;
}

/**
 * Builds every API client the extension needs from a single environment (and, optionally, the
 * current 3-legged access token). This is the one place client construction happens - switching
 * environments and logging in/out both just call this again and replace the old clients, rather
 * than mutating existing client instances in place.
 */
export function createClients(env: IEnvironment, threeLeggedToken?: string): IClients {
    const sdkManager = createApsSdkManager(env.host);
    // The Hubs view's Data Management client and `modelDerivativeClient3L` need to run in a user
    // context; fall back to the 2-legged provider when no 3-legged token is available yet.
    const userAuthenticationProvider = threeLeggedToken
        ? new StaticTokenAuthenticationProvider(threeLeggedToken)
        : new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, DATA_MANAGEMENT_SCOPES, env.host);

    return {
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        authenticationClient: new AuthenticationClient({ sdkManager }),
        dataManagementClient: new OssClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, OSS_SCOPES, env.host)
        }),
        modelDerivativeClient2L: new ModelDerivativeClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, MODEL_DERIVATIVE_SCOPES, env.host)
        }),
        modelDerivativeClient3L: new ModelDerivativeClient({ sdkManager, authenticationProvider: userAuthenticationProvider }),
        designAutomationClient: createDesignAutomationClient(env),
        webhookClient: new WebhooksClient({
            sdkManager,
            authenticationProvider: new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, WEBHOOKS_SCOPES, env.host)
        }),
        bim360Client: new DataManagementClient({ sdkManager, authenticationProvider: userAuthenticationProvider }),
        secureServiceAccountsClient: createSecureServiceAccountsClient(env)
    };
}
