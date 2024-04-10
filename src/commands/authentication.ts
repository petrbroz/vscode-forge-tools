import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';
import { IContext, showErrorMessage } from '../common';

const DefaultScopes = [
    'viewables:read', 
    'code:all', 
    'bucket:create','bucket:read','bucket:update', 'bucket:delete', 
    'data:read', 'data:write', 'data:create', 'data:search',
    'account:read', 'account:write', 
    'user:read', 'user:write',
    'user-profile:read'
]; // TODO: make the list configurable?

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

function renderCallbackPage(): string {
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
                <p>
                    Retrieving the token...
                </p>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js" integrity="sha384-w76AqPfDkMBDXo30jS1Sgez6pr3x5MlQ1ZAGC+nuZB+EYdgRZgiwxhTBTkF7CXvN" crossorigin="anonymous"></script>
            <script>
                const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port;
                const { hash } = window.location;
                const params = new Map();
                hash.substr(1).split('&').forEach(pair => {
                    const tokens = pair.split('=');
                    if (tokens.length === 2) {
                        params.set(tokens[0], tokens[1]);
                    }
                });
                const url = new URL(baseUrl + '/auth/save');
                url.searchParams.set('access_token', params.get('access_token'));
                url.searchParams.set('expires_in', params.get('expires_in'));
                url.searchParams.set('token_type', params.get('token_type'));
                window.location.replace(url.toString());
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

export async function login(clientId: string, port: number, context: IContext): Promise<Map<string, string>> {
    const timeout = 2 * 60 * 1000; // Wait for 2 minutes
    const scopes = DefaultScopes; 
    return new Promise(function (resolve, reject) {
        const server = http.createServer(function (req, res) {
            if (req.url === '/') {
                res.end(renderLoginPage(clientId, port, scopes));
            } else if (req.url === '/auth/callback') {
                res.end(renderCallbackPage());
            } else if (req.url === '/auth/cancel') {
                res.end(renderMessagePage('Login process has been cancelled.'));
                server.close();
                reject('Cancelled by user.');
            } else if (req.url?.startsWith('/auth/save')) {
                const url = new URL(req.url, `http://localhost:${port}`);
                const params = new Map<string, string>(url.searchParams.entries());
                res.end(renderMessagePage('You are logged in!'));
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