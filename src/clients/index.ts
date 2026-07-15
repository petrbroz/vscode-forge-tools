import { AuthenticationClient, DataManagementClient, ModelDerivativeClient, DesignAutomationClient, WebhooksClient, BIM360Client } from 'aps-sdk-node';
import { IAuthOptions, Region } from 'aps-sdk-node/dist/common';
import { SecureServiceAccountClient } from '@aps_sdk/secure-service-account';
import { IEnvironment, DesignAutomationRegion } from '../environment';
import { createSecureServiceAccountsClient } from './secure-service-accounts';

export interface IClients {
    credentials: IAuthOptions;
    authenticationClient: AuthenticationClient;
    dataManagementClient: DataManagementClient;
    modelDerivativeClient2L: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L: ModelDerivativeClient; // client for 3-legged workflows
    designAutomationClient: DesignAutomationClient;
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    secureServiceAccountsClient: SecureServiceAccountClient;
}

/**
 * Builds every API client the extension needs from a single environment (and, optionally, the
 * current 3-legged access token). This is the one place client construction happens - switching
 * environments and logging in/out both just call this again and replace the old clients, rather
 * than mutating existing client instances in place.
 */
export function createClients(env: IEnvironment, threeLeggedToken?: string): IClients {
    const credentials: IAuthOptions = { client_id: env.clientId, client_secret: env.clientSecret };
    const threeLeggedAuth: IAuthOptions = threeLeggedToken ? { token: threeLeggedToken } : credentials;
    return {
        credentials,
        authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret, env.host),
        dataManagementClient: new DataManagementClient(credentials, env.host, env.region as Region),
        modelDerivativeClient2L: new ModelDerivativeClient(credentials, env.host, env.region as Region),
        modelDerivativeClient3L: new ModelDerivativeClient({ token: threeLeggedToken || '' }, env.host, env.region as Region),
        designAutomationClient: new DesignAutomationClient(credentials, env.host, env.region as Region, env.designAutomationRegion as DesignAutomationRegion),
        webhookClient: new WebhooksClient(credentials, env.host, env.region as Region),
        bim360Client: new BIM360Client(threeLeggedAuth, env.host, env.region as Region),
        secureServiceAccountsClient: createSecureServiceAccountsClient(env)
    };
}
