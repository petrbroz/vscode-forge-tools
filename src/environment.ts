import * as vscode from 'vscode';
import { IEnvironment } from './models/environment';

/** Key into `workspaceState` for the environment last selected in this workspace (see {@link pickDefaultEnvironment}). */
export const LAST_ENVIRONMENT_KEY = 'aps.lastEnvironment';

export function getEnvironments(): IEnvironment[] {
    return vscode.workspace.getConfiguration(undefined, null).get<IEnvironment[]>('autodesk.forge.environments') || [];
}

/** Picks the environment to activate on startup: the one last selected in this workspace, if it still exists, otherwise the first configured environment. */
export function pickDefaultEnvironment(environments: IEnvironment[], workspaceState: vscode.Memento): IEnvironment {
    const lastTitle = workspaceState.get<string>(LAST_ENVIRONMENT_KEY);
    return environments.find(environment => environment.title === lastTitle) || environments[0];
}

export async function setupNewEnvironment() {
    try {
        const choice = await vscode.window.showInformationMessage('APS application credentials are missing. Configure them in VSCode settings.', 'Enter APS Credentials');
        if (choice === 'Enter APS Credentials') {
            const clientId = await vscode.window.showInputBox({ prompt: 'Enter APS client ID', ignoreFocusOut: true });
            if (!clientId) {
                return;
            }
            const clientSecret = await vscode.window.showInputBox({ prompt: 'Enter APS client secret', ignoreFocusOut: true });
            if (!clientSecret) {
                return;
            }
            const region = await vscode.window.showQuickPick(['US', 'EMEA', 'AUS', 'CAN', 'DEU', 'IND', 'JPN', 'GBR'], { placeHolder: 'Choose your APS region', ignoreFocusOut: true });
            if (!region) {
                return;
            }
            const title = await vscode.window.showInputBox({ prompt: 'Give your new environment a name', ignoreFocusOut: true });
            if (!title) {
                return;
            }
            const environments: IEnvironment[] = [{ title, clientId, clientSecret, region }];
            await vscode.workspace.getConfiguration().update('autodesk.forge.environments', environments, true);
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Could not setup APS environment: ${err}`);
    }
}