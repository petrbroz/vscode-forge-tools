import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';

const DefaultScopes = ['viewables:read', 'bucket:read', 'bucket:create', 'data:read', 'data:create', 'data:write', 'code:all']; // Make this list configurable?

export async function login(clientId: string, port: number, context: IContext): Promise<Map<string, string>> {
    const timeout = 2 * 60 * 1000; // Wait for 2 minutes
    const scopes = ['data:read', 'viewables:read'];
    return new Promise(function (resolve, reject) {
        const server = http.createServer(function (req, res) {
            if (req.url === '/') {
                res.write(context.templateEngine.render('login', { clientId, port, scopes }));
                res.end();
            } else if (req.url === '/vscode-forge-tools/auth/callback') {
                res.write(context.templateEngine.render('login-callback', {}));
                res.end();
            } else if (req.url === '/vscode-forge-tools/auth/cancel') {
                res.write(context.templateEngine.render('login-message', { message: 'Login process has been cancelled.' }));
                res.end();
                server.close();
                reject('Cancelled by user.');
            } else if (req.url?.startsWith('/vscode-forge-tools/auth/save')) {
                const parsedUrl = url.parse(req.url);
                let params = new Map<string, string>();
                for (const query of parsedUrl.query?.split('&') || []) {
                    const tokens = query.split('=');
                    if (tokens.length === 2) {
                        params.set(tokens[0], tokens[1]);
                    }
                }
                res.write(context.templateEngine.render('login-message', { message: 'You are logged in!' }));
                res.end();
                server.close();
                resolve(params);
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
    const scopes = await vscode.window.showInputBox({ prompt: 'Enter the scopes for your token', value: DefaultScopes.join(' ') });
    if (!scopes) {
        return;
    }
    try {
        const credentials = await context.authenticationClient.authenticate(scopes?.split(' ') || []);
        const action = await vscode.window.showInformationMessage(`Access token generated (expires in: ${credentials.expires_in} seconds)`, 'Copy Token to Clipboard');
        if (action === 'Copy Token to Clipboard') {
            await vscode.env.clipboard.writeText(credentials.access_token);
        }
    } catch (err) {
        showErrorMessage('Could not generate access token', err);
    }
}