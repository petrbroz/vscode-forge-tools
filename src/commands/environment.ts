import * as vscode from 'vscode';
import { IContext } from '../common';
import { DesignAutomationRegion, getEnvironments, IEnvironment } from '../environment';
import { ClientCredentialsAuthenticationProvider, DefaultRequestAdapter, createSecureServiceAccountsClient } from '../clients';
import { Region } from 'aps-sdk-node/dist/common';
import { AuthenticationClient } from 'aps-sdk-node';

export function registerEnvironmentCommands(context: IContext, refresh: () => void) {
    vscode.commands.registerCommand('forge.switchEnvironment', async () => {
        const environments = getEnvironments();
        const name = await vscode.window.showQuickPick(environments.map(env => env.title), { placeHolder: 'Select APS environment' });
        if (!name) {
            return;
        }
        const env = environments.find(environment => environment.title === name) as IEnvironment;
        delete context.threeLeggedToken;
        const defaultRequestAdapter = new DefaultRequestAdapter(new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret))
        context.environment = env;
        context.credentials = { client_id: env.clientId, client_secret: env.clientSecret };
        context.dataManagementClient.reset(context.credentials, env.host, env.region as Region);
        context.modelDerivativeClient2L.reset(context.credentials, env.host, env.region as Region);
        context.modelDerivativeClient3L.reset({ token: '' }, env.host, env.region as Region);
        context.designAutomationClient.reset(context.credentials, env.host, env.region as Region, env.designAutomationRegion as DesignAutomationRegion);
        context.webhookClient.reset(context.credentials, env.host, env.region as Region);
        context.bim360Client.reset(context.credentials, env.host, env.region as Region);
        context.authenticationClient = new AuthenticationClient(env.clientId, env.clientSecret, env.host);
        context.secureServiceAccountsClient = createSecureServiceAccountsClient(defaultRequestAdapter);
        refresh();
        // simpleStorageDataProvider.refresh();
        // designAutomationDataProvider.refresh();
        // hubsDataProvider.refresh();
        // webhooksDataProvider.refresh();
        // secureServiceAccountsProvider.refresh();
        // updateEnvironmentStatus(envStatusBarItem);
    });
}
