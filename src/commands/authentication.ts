import * as http from 'http';
import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';
import { IThreeLeggedToken } from 'aps-sdk-node';
import { Region } from 'aps-sdk-node/dist/common';
import { CommandCategory, Command, CommandRegistry } from './shared';

const DefaultAuthPort = 8123;

export const DefaultScopes = [
    'viewables:read', 
    'code:all', 
    'bucket:create','bucket:read','bucket:update', 'bucket:delete', 
    'data:read', 'data:write', 'data:create', 'data:search',
    'account:read', 'account:write', 
    'user:read', 'user:write',
    'user-profile:read'
]; // TODO: make the list configurable?

@CommandCategory({ category: 'Autodesk Platform Services > Authentication', prefix: 'aps.auth' })
export class AuthenticationCommands extends CommandRegistry {
    constructor(protected context: IContext, protected refresh: () => void) {
        super();
    }

    @Command({ title: 'Login', icon: 'sign-in' })
    async login() {
        const env = this.context.environment;
        try {
            const port = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.authentication.port') || DefaultAuthPort;
            const clientId = this.context.environment.clientId;
            const credentials = await login(clientId, port, this.context);
            const token = credentials.access_token;
            const expires = credentials.expires_in;
            if (!token || !expires) {
                throw new Error('Authentication data missing or incorrect.');
            }
            this.context.threeLeggedToken = token;
            this.context.bim360Client.reset({ token: this.context.threeLeggedToken }, env.host, env.region as Region);
            delete (this.context.bim360Client as any).auth; // TODO: remove 'auth' in the reset method
            this.context.modelDerivativeClient3L.reset({ token: this.context.threeLeggedToken }, env.host, env.region as Region);
            this.refresh();
            vscode.window.showInformationMessage(`You are now logged in. Autodesk Platform Services requiring 3-legged authentication will be available for as long as the generated token is valid (${expires} seconds), or until you manually log out.`);
        } catch (err) {
            vscode.window.showWarningMessage(`Could not log in: ${err}`);
        }
    }

    @Command({ title: 'Logout', icon: 'sign-out' })
    async logout() {
		const answer = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Would you like to log out?' });
        const env = this.context.environment;
		if (answer === 'Yes') {
			delete this.context.threeLeggedToken;
			this.context.bim360Client.reset(this.context.credentials, env.host, env.region as Region);
			delete (this.context.bim360Client as any).token; // TODO: remove 'token' in the reset method
			this.context.modelDerivativeClient3L.reset({ token: '' }, env.host, env.region as Region);
            this.refresh();
			vscode.window.showInformationMessage(`You are now logged out. Autodesk Platform Services requiring 3-legged authentication will no longer be available.`);
		}
    }

    @Command({ title: 'Generate Access Token', icon: 'key' })
    async getAccessToken() {
        await getAccessToken(this.context);
    }
}

function renderLoginPage(clientId: string, port: number, scopes: string[]): string {
    return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-GLhlTQ8iRABdZLl6O3oVMWSktQOp6b7In1Zl3/Jr59b6EGGoI1aFkw7cmDA6j6gD" crossorigin="anonymous">
            <title>Autodesk Platform Services: Login</title>
        </head>
        <body>
            <div class="container">
                <h1>Autodesk Platform Services</h1>
                <h2>Login</h2>
                <ol>
                    <li>Go to <a href="https://aps.autodesk.com/myapps">https://aps.autodesk.com/myapps</a></li>
                    <li>Find your application with the following client ID: <em>${clientId}</em></li>
                    <li>Add the following callback URL: <em>http://localhost:${port}/auth/callback</em></li>
                    <li>Hit the <em>Login</em> button below</li>
                </ol>
                <a href="#" id="login" class="btn btn-outline-primary">Login</a>
                <a href="#" id="cancel" class="btn btn-outline-secondary">Cancel</a>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js" integrity="sha384-w76AqPfDkMBDXo30jS1Sgez6pr3x5MlQ1ZAGC+nuZB+EYdgRZgiwxhTBTkF7CXvN" crossorigin="anonymous"></script>
            <script>
                const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port;
                document.getElementById('login').addEventListener('click', () => {
                    const url = new URL('https://developer.api.autodesk.com/authentication/v2/authorize');
                    url.searchParams.set('client_id', '${clientId}');
                    url.searchParams.set('redirect_uri', baseUrl + '/auth/callback');
                    url.searchParams.set('response_type', 'code');
                    url.searchParams.set('scope', '${scopes.join(' ')}');
                    window.location.replace(url.toString());
                });
                document.getElementById('cancel').addEventListener('click', () => {
                    window.location.replace(baseUrl + '/auth/cancel');
                });
            </script>
        </body>
        </html>
    `;
}

function renderMessagePage(message: string): string {
    return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-GLhlTQ8iRABdZLl6O3oVMWSktQOp6b7In1Zl3/Jr59b6EGGoI1aFkw7cmDA6j6gD" crossorigin="anonymous">
            <title>Autodesk Platform Services: Login</title>
        </head>
        <body>
            <div class="container">
                <h1>Autodesk Platform Services</h1>
                <h2>Login</h2>
                <p>${message}</p>
                <p>You can close this page now...</p>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js" integrity="sha384-w76AqPfDkMBDXo30jS1Sgez6pr3x5MlQ1ZAGC+nuZB+EYdgRZgiwxhTBTkF7CXvN" crossorigin="anonymous"></script>
        </body>
        </html>
    `;
}

export async function login(clientId: string, port: number, context: IContext): Promise<IThreeLeggedToken> {
    const timeout = 2 * 60 * 1000; // Wait for 2 minutes
    const scopes = DefaultScopes; 
    return new Promise(function (resolve, reject) {
        const server = http.createServer(async function (req, res) {
            if (req.url === '/') {
                res.end(renderLoginPage(clientId, port, scopes));
            } else if (req.url === '/auth/cancel') {
                res.end(renderMessagePage('Login process has been cancelled.'));
                server.close();
                reject('Cancelled by user.');
            } else if (req.url?.startsWith('/auth/callback')) {
                const url = new URL(req.url, `http://localhost:${port}`);
                const code = url.searchParams.get('code') as string;
                url.searchParams.delete('code');
                const credentials = await context.authenticationClient.getToken(code, url.toString());
                res.end(renderMessagePage('You are logged in!'));
                server.close();
                resolve(credentials);
            } else {
                res.statusCode = 404;
                res.end();
            }
        }).listen(port);
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
        setTimeout(() => {
            server.close();
            reject('Session timed out.');
        }, timeout);
    });
}

export async function getAccessToken(context: IContext) {
    const scopes = await vscode.window.showQuickPick(DefaultScopes, { canPickMany: true, placeHolder: 'Select scopes for the access token', ignoreFocusOut: true });
    if (!scopes) {
        return;
    }
    try {
        const credentials = await context.authenticationClient.authenticate(scopes);
        const action = await vscode.window.showInformationMessage(`Access token generated (expires in: ${credentials.expires_in} seconds)`, 'Copy Token to Clipboard');
        if (action === 'Copy Token to Clipboard') {
            await vscode.env.clipboard.writeText(credentials.access_token);
        }
    } catch (err) {
        showErrorMessage('Could not generate access token', err, context);
    }
}
