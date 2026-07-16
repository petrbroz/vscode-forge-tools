import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { ApsAuthenticationProvider } from '../auth-provider';

export class AuthenticationCommands {
    constructor(protected context: IContext, protected authProvider: ApsAuthenticationProvider) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.auth.login', this.login.bind(this)),
            vscode.commands.registerCommand('aps.auth.logout', this.logout.bind(this)),
            vscode.commands.registerCommand('aps.auth.getAccessToken', this.getAccessToken.bind(this)),
        ];
    }

    async login() {
        try {
            // Delegates to the APS authentication provider, which runs the sign-in-mode quick-pick and
            // persists the session. The extension's onDidChangeSessions handler rebuilds the services.
            await vscode.authentication.getSession(ApsAuthenticationProvider.id, [], { createIfNone: true, clearSessionPreference: true });
        } catch (err) {
            vscode.window.showWarningMessage(`Could not log in: ${err}`);
        }
    }

    async logout() {
        const sessions = await this.authProvider.getSessions();
        if (sessions.length === 0) {
            vscode.window.showInformationMessage('You are not signed in.');
            return;
        }
        const answer = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Would you like to sign out?' });
        if (answer === 'Yes') {
            await this.authProvider.removeSession(sessions[0].id);
            vscode.window.showInformationMessage(`You are now signed out. Autodesk Platform Services requiring a user context will no longer be available.`);
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
