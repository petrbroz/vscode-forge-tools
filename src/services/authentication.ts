import * as http from 'http';
import * as crypto from 'crypto';
import { AuthenticationClient, Scopes, ThreeLeggedToken } from '@aps_sdk/authentication';

/** Base64url-encodes a buffer (RFC 7636 / PKCE: no padding, URL-safe alphabet). */
function base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generates a PKCE `code_verifier` and its S256 `code_challenge`. */
function generatePkcePair(): { verifier: string; challenge: string } {
    const verifier = base64UrlEncode(crypto.randomBytes(32));
    const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
}

/** Scopes offered when generating access tokens and requested during the 3-legged login flow. */
const DefaultScopes: string[] = [
    Scopes.ViewablesRead,
    Scopes.CodeAll,
    Scopes.BucketCreate, Scopes.BucketRead, Scopes.BucketUpdate, Scopes.BucketDelete,
    Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.DataSearch,
    Scopes.AccountRead, Scopes.AccountWrite,
    Scopes.UserRead, Scopes.UserWrite,
    Scopes.UserProfileRead
]; // TODO: make the list configurable?

function renderLoginPage(clientId: string, port: number, scopes: string[], codeChallenge?: string): string {
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
                    ${codeChallenge ? `url.searchParams.set('code_challenge', '${codeChallenge}');
                    url.searchParams.set('code_challenge_method', 'S256');` : ''}
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

/**
 * Domain logic for Authentication. Wraps an `AuthenticationClient` and exposes plain, domain-shaped
 * operations (2-legged access tokens and the 3-legged OAuth login flow) so the vscode layers never
 * touch the SDK's client or enums. Owns the OAuth callback HTTP server and the login/success HTML;
 * the vscode layer only opens the browser (via the `onListening` callback) and surfaces messages.
 */
export class AuthenticationService {
    constructor(
        private readonly client: AuthenticationClient,
        private readonly clientId: string,
        private readonly clientSecret: string
    ) {}

    /** Scopes offered when generating access tokens and requested during the 3-legged login flow. */
    get defaultScopes(): string[] {
        return DefaultScopes;
    }

    /** Generates a 2-legged (application) access token for the given scopes. */
    async getAccessToken(scopes: string[]): Promise<{ accessToken: string; expiresIn: number }> {
        const credentials = await this.client.getTwoLeggedToken(this.clientId, this.clientSecret, scopes as Scopes[]);
        return { accessToken: credentials.access_token!, expiresIn: credentials.expires_in! };
    }

    /**
     * Runs the 3-legged OAuth login flow for a confidential client (exchanges the authorization code
     * using the client secret). Starts a local HTTP callback server on `port`, invokes `onListening`
     * with the local URL for the caller to open in the browser, and resolves with the user token once
     * the callback delivers an authorization code and it's exchanged. Rejects if the user cancels or the
     * flow times out (2 minutes).
     */
    login(clientId: string, port: number, onListening: (url: string) => void): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        return this.runLoginFlow(clientId, port, onListening,
            (code, redirectUri) => this.client.getThreeLeggedToken(clientId, code, redirectUri, { clientSecret: this.clientSecret }));
    }

    /**
     * Runs the 3-legged OAuth login flow for a public client using PKCE (no client secret): generates a
     * `code_verifier`/`code_challenge` pair, passes the challenge to the authorize page, and exchanges
     * the authorization code with the verifier. Otherwise identical to {@link login}.
     */
    loginWithPkce(clientId: string, port: number, onListening: (url: string) => void): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        const { verifier, challenge } = generatePkcePair();
        return this.runLoginFlow(clientId, port, onListening,
            (code, redirectUri) => this.client.getThreeLeggedToken(clientId, code, redirectUri, { code_verifier: verifier }), challenge);
    }

    /**
     * Shared machinery for the 3-legged login flows: serves the login/callback pages from a local HTTP
     * server and defers the token exchange to `exchange` (which differs between the confidential and
     * PKCE flows). Passing `codeChallenge` adds the PKCE parameters to the authorize URL.
     */
    private runLoginFlow(
        clientId: string,
        port: number,
        onListening: (url: string) => void,
        exchange: (code: string, redirectUri: string) => Promise<ThreeLeggedToken>,
        codeChallenge?: string
    ): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        const timeout = 2 * 60 * 1000; // Wait for 2 minutes
        const scopes = DefaultScopes;
        return new Promise(function (resolve, reject) {
            const server = http.createServer(async function (req, res) {
                if (req.url === '/') {
                    res.end(renderLoginPage(clientId, port, scopes, codeChallenge));
                } else if (req.url === '/auth/cancel') {
                    res.end(renderMessagePage('Login process has been cancelled.'));
                    server.close();
                    reject('Cancelled by user.');
                } else if (req.url?.startsWith('/auth/callback')) {
                    try {
                        const url = new URL(req.url, `http://localhost:${port}`);
                        const code = url.searchParams.get('code') as string;
                        url.searchParams.delete('code');
                        const credentials = await exchange(code, url.toString());
                        res.end(renderMessagePage('You are logged in!'));
                        server.close();
                        if (!credentials.access_token || !credentials.expires_in) {
                            reject(new Error('Authentication data missing or incorrect.'));
                            return;
                        }
                        resolve({ token: credentials.access_token, expiresIn: credentials.expires_in, refreshToken: credentials.refresh_token });
                    } catch (err) {
                        server.close();
                        reject(err);
                    }
                } else {
                    res.statusCode = 404;
                    res.end();
                }
            }).listen(port);
            onListening(`http://localhost:${port}`);
            setTimeout(() => {
                server.close();
                reject('Session timed out.');
            }, timeout);
        });
    }
}
