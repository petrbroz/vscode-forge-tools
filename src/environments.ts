import * as vscode from 'vscode';

export interface IEnvironment {
    title: string;
    clientId: string;
    clientSecret: string;
    region?: string;
    host?: string;
    designAutomationRegion?: string;
}

export function getEnvironments(): IEnvironment[] {
    let environments = vscode.workspace.getConfiguration(undefined, null).get<IEnvironment[]>('autodesk.forge.environments') || [];
    if (environments.length === 0) {
        // See if there are extension settings using the old format
        const oldClientId = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.clientId') || '';
        const oldClientSecret = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.clientSecret') || '';
        const oldDataRegion = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.dataRegion') || 'US';

        if (oldClientId && oldClientSecret) {
            vscode.window.showInformationMessage('The settings format has changed. Please see the README for more details.');
            environments.push({
                title: '(no title)',
                clientId: oldClientId,
                clientSecret: oldClientSecret,
                region: oldDataRegion
            });
        }
    }
    return environments;
}

export async function setupNewEnvironment() {
    try {
        const choice = await vscode.window.showInformationMessage('Forge credentials are missing. Configure them in VSCode settings.', 'Enter Forge Credentials');
        if (choice === 'Enter Forge Credentials') {
            const clientId = await vscode.window.showInputBox({ prompt: 'Enter Forge client ID', ignoreFocusOut: true });
            if (!clientId) {
                return;
            }
            const clientSecret = await vscode.window.showInputBox({ prompt: 'Enter Forge client secret', ignoreFocusOut: true });
            if (!clientSecret) {
                return;
            }
            const region = await vscode.window.showQuickPick(['US', 'EMEA'], { placeHolder: 'Choose your Forge region', ignoreFocusOut: true });
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
        vscode.window.showErrorMessage(`Could not setup Forge environment: ${err}`);
    }
}