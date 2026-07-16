import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { createServices } from '../services';

const DefaultAuthPort = 8123;

export class AuthenticationCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.auth.login', this.login.bind(this)),
            vscode.commands.registerCommand('aps.auth.logout', this.logout.bind(this)),
            vscode.commands.registerCommand('aps.auth.getAccessToken', this.getAccessToken.bind(this)),
        ];
    }

    async login() {
        const env = this.context.environment;
        try {
            const port = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.authentication.port') || DefaultAuthPort;
            const clientId = this.context.environment.clientId;
            const { token, expiresIn } = await this.context.authenticationService.login(clientId, port, (url) => {
                vscode.env.openExternal(vscode.Uri.parse(url));
            });
            this.context.threeLeggedToken = token;
            Object.assign(this.context, createServices(env, token));
            this.refresh();
            vscode.window.showInformationMessage(`You are now logged in. Autodesk Platform Services requiring 3-legged authentication will be available for as long as the generated token is valid (${expiresIn} seconds), or until you manually log out.`);
        } catch (err) {
            vscode.window.showWarningMessage(`Could not log in: ${err}`);
        }
    }

    async logout() {
		const answer = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Would you like to log out?' });
        const env = this.context.environment;
		if (answer === 'Yes') {
			delete this.context.threeLeggedToken;
			Object.assign(this.context, createServices(env));
            this.refresh();
			vscode.window.showInformationMessage(`You are now logged out. Autodesk Platform Services requiring 3-legged authentication will no longer be available.`);
		}
    }

    async getAccessToken() {
        const scopes = await vscode.window.showQuickPick(this.context.authenticationService.defaultScopes, { canPickMany: true, placeHolder: 'Select scopes for the access token', ignoreFocusOut: true });
        if (!scopes) {
            return;
        }
        try {
            const { accessToken, expiresIn } = await this.context.authenticationService.getAccessToken(scopes);
            const action = await vscode.window.showInformationMessage(`Access token generated (expires in: ${expiresIn} seconds)`, 'Copy Token to Clipboard');
            if (action === 'Copy Token to Clipboard') {
                await vscode.env.clipboard.writeText(accessToken);
            }
        } catch (err) {
            showErrorMessage('Could not generate access token', err, this.context);
        }
    }
}
