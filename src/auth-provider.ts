import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { IContext, withProgress } from './common';
import { IEnvironment } from './models/environment';
import { ApsAuthMode, ApsAuthModeKind, IApsAuthSession } from './models/authentication';

/** How long to wait for the OAuth browser redirect to reach {@link ApsAuthenticationProvider.handleUri}. */
const LoginTimeoutMs = 2 * 60 * 1000;

interface IModeQuickPickItem extends vscode.QuickPickItem {
    authMode: ApsAuthModeKind;
}

interface IPendingLogin {
    resolve: (code: string) => void;
    reject: (reason: Error) => void;
}

/**
 * VS Code authentication provider for Autodesk Platform Services. Owns the single active user-context
 * session per environment: `createSession` runs a quick-pick over the sign-in modes (3-legged OAuth,
 * PKCE, Secure Service Account, pasted token), drives the chosen flow via the domain services, and
 * persists the resulting {@link IApsAuthSession} - including any secret material needed to refresh or
 * re-mint the token - to `context.secrets`, keyed per environment so it survives a window reload.
 *
 * Also implements `vscode.UriHandler` for the `vscode://<publisher>.<name>/callback` redirect used by
 * the 3-legged OAuth flows (see {@link runOAuthFlow}) - this replaces the previous local HTTP callback
 * server, so the login flow works the same way in desktop, remote, and web (vscode.dev) contexts.
 *
 * This is vscode glue: it imports `vscode` and the domain services (via the `IContext` accessor) but
 * never `@aps_sdk/*` - token minting/refresh lives entirely in the services layer.
 */
export class ApsAuthenticationProvider implements vscode.AuthenticationProvider, vscode.UriHandler {
    static readonly id = 'aps';
    static readonly label = 'Autodesk Platform Services';

    private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;
    private readonly pendingLogins = new Map<string, IPendingLogin>();

    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly getContext: () => IContext
    ) {}

    private secretKey(env: IEnvironment): string {
        return `aps.session.${env.clientId}`;
    }

    /** Reads the persisted session for an environment, if any. */
    async getStoredSession(env: IEnvironment): Promise<IApsAuthSession | undefined> {
        const raw = await this.secrets.get(this.secretKey(env));
        return raw ? JSON.parse(raw) as IApsAuthSession : undefined;
    }

    /** Re-persists a session whose token material changed (e.g. after a refresh); fires no change event. */
    async updateStoredSession(env: IEnvironment, session: IApsAuthSession): Promise<void> {
        await this.secrets.store(this.secretKey(env), JSON.stringify(session));
    }

    async getSessions(_scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
        const env = this.getContext().environment;
        const session = await this.getStoredSession(env);
        return session ? [this.toAuthSession(session)] : [];
    }

    async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
        const env = this.getContext().environment;
        const kind = await this.pickMode();
        if (!kind) {
            throw new Error('Login cancelled.');
        }
        const session = await this.runModeFlow(env, kind, [...scopes]);
        await this.secrets.store(this.secretKey(env), JSON.stringify(session));
        const authSession = this.toAuthSession(session);
        this._onDidChangeSessions.fire({ added: [authSession], removed: [], changed: [] });
        return authSession;
    }

    async removeSession(_sessionId: string): Promise<void> {
        const env = this.getContext().environment;
        const existing = await this.getStoredSession(env);
        await this.secrets.delete(this.secretKey(env));
        if (existing) {
            this._onDidChangeSessions.fire({ added: [], removed: [this.toAuthSession(existing)], changed: [] });
        }
    }

    private toAuthSession(session: IApsAuthSession): vscode.AuthenticationSession {
        return {
            id: session.id,
            accessToken: session.accessToken,
            account: { id: session.environmentKey, label: session.label },
            scopes: session.scopes
        };
    }

    private async pickMode(): Promise<ApsAuthModeKind | undefined> {
        const items: IModeQuickPickItem[] = [
            { authMode: 'authorization-code', label: '$(sign-in) 3-legged OAuth', detail: 'Interactive browser login using your APS app client ID and secret (confidential client). Requires a callback URL registered on your app.' },
            { authMode: 'authorization-code-pkce', label: '$(sign-in) 3-legged OAuth with PKCE', detail: 'Interactive browser login for public clients, without a client secret. Requires a callback URL registered on your app.' },
            { authMode: 'service-account', label: '$(robot) Secure Service Account', detail: 'Sign in on behalf of a secure service account using its private key.' },
            { authMode: 'manual-token', label: '$(key) Paste access token', detail: 'Use an access token obtained from another APS application.' }
        ];
        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select an APS authentication method', ignoreFocusOut: true });
        return picked?.authMode;
    }

    /**
     * Handles the `vscode://<publisher>.<name>/callback` redirect delivered after the user completes
     * the APS login page in the browser. Matches the callback's `state` query parameter against a
     * pending {@link runOAuthFlow} call and resolves/rejects it; unrecognized or already-settled `state`
     * values (e.g. a duplicate/stale redirect) are ignored.
     */
    handleUri(uri: vscode.Uri): void {
        const params = new URLSearchParams(uri.query);
        const state = params.get('state');
        const pending = state ? this.pendingLogins.get(state) : undefined;
        if (!state || !pending) {
            return;
        }
        this.pendingLogins.delete(state);
        const error = params.get('error');
        if (error) {
            pending.reject(new Error(params.get('error_description') || error));
            return;
        }
        const code = params.get('code');
        if (!code) {
            pending.reject(new Error('Authorization callback did not include a code.'));
            return;
        }
        pending.resolve(code);
    }

    private openBrowser = (url: string) => {
        vscode.env.openExternal(vscode.Uri.parse(url));
    };

    /**
     * Runs the 3-legged OAuth authorization code grant using VS Code's URI-handler pattern instead of a
     * local HTTP server: builds a `vscode://<publisher>.<name>/callback` redirect URI (resolved through
     * `vscode.env.asExternalUri` so it also works from remote/web contexts), opens the APS authorize page
     * in the system browser, and waits for {@link handleUri} to deliver the matching authorization code.
     * Pass `usePkce: true` for the public-client PKCE flow (no client secret exchanged).
     */
    private async runOAuthFlow(env: IEnvironment, usePkce: boolean): Promise<{ token: string; expiresIn: number; refreshToken?: string }> {
        const { authenticationService, extensionContext } = this.getContext();
        const state = randomUUID();
        const externalUri = await vscode.env.asExternalUri(
            vscode.Uri.parse(`${vscode.env.uriScheme}://${extensionContext.extension.id}/callback`)
        );
        const redirectUri = this.stripWindowId(externalUri).toString(true);
        await this.notifyCallbackUriIfNeeded(env, redirectUri, extensionContext);

        const pkce = usePkce ? authenticationService.createPkcePair() : undefined;
        const authorizeUrl = authenticationService.buildAuthorizationUrl(env.clientId, redirectUri, state, pkce?.challenge);

        const codePromise = this.waitForCallback(state);
        this.openBrowser(authorizeUrl);
        const code = await codePromise;

        return pkce
            ? authenticationService.exchangeAuthorizationCodeWithPkce(env.clientId, code, redirectUri, pkce.verifier)
            : authenticationService.exchangeAuthorizationCode(env.clientId, code, redirectUri);
    }

    /**
     * Warns the user, before opening the browser, that the 3-legged OAuth flow needs `redirectUri`
     * registered as a callback URL on their APS app - otherwise the login page will reject it with a
     * redirect URI mismatch. Shown once per environment (tracked in `globalState`, keyed by client ID)
     * unless dismissed without acknowledging, in which case it's shown again on the next login attempt.
     */
    private async notifyCallbackUriIfNeeded(env: IEnvironment, redirectUri: string, extensionContext: vscode.ExtensionContext): Promise<void> {
        const seenKey = `aps.callbackUriNotified.${env.clientId}`;
        if (extensionContext.globalState.get<boolean>(seenKey)) {
            return;
        }
        const action = await vscode.window.showInformationMessage(
            `Signing in to Autodesk Platform Services requires this callback URL to be registered for your app: ${redirectUri}`,
            'Copy URL & Open APS Dev Portal', 'Got it, don\'t show again'
        );
        if (action === 'Copy URL & Open APS Dev Portal') {
            await vscode.env.clipboard.writeText(redirectUri);
            vscode.env.openExternal(vscode.Uri.parse('https://aps.autodesk.com/myapps'));
        }
        if (action) {
            await extensionContext.globalState.update(seenKey, true);
        }
    }

    /**
     * `vscode.env.asExternalUri` appends a `windowId` query parameter to `vscode://` URIs on desktop, so
     * the OS can route the callback back to this window. That value changes across window reloads/
     * restarts, so leaving it in would make the OAuth `redirect_uri` different on every login attempt -
     * and APS requires an exact match against the app's registered callback URL. Strips it out.
     */
    private stripWindowId(uri: vscode.Uri): vscode.Uri {
        const query = new URLSearchParams(uri.query);
        query.delete('windowId');
        return uri.with({ query: query.toString() });
    }

    /** Registers a pending login under `state`, settled by {@link handleUri} or after {@link LoginTimeoutMs}. */
    private waitForCallback(state: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingLogins.delete(state);
                reject(new Error('Login timed out.'));
            }, LoginTimeoutMs);
            this.pendingLogins.set(state, {
                resolve: code => { clearTimeout(timer); resolve(code); },
                reject: err => { clearTimeout(timer); reject(err); }
            });
        });
    }

    private async runModeFlow(env: IEnvironment, kind: ApsAuthModeKind, scopes: string[]): Promise<IApsAuthSession> {
        const { authenticationService } = this.getContext();
        const base = { id: randomUUID(), environmentKey: env.clientId };
        switch (kind) {
            case 'authorization-code': {
                const { token, expiresIn, refreshToken } = await this.runOAuthFlow(env, false);
                return { ...base, mode: { kind }, scopes: authenticationService.defaultScopes, label: '3-legged', accessToken: token, expiresAt: Date.now() + expiresIn * 1000, refreshToken };
            }
            case 'authorization-code-pkce': {
                const { token, expiresIn, refreshToken } = await this.runOAuthFlow(env, true);
                return { ...base, mode: { kind }, scopes: authenticationService.defaultScopes, label: '3-legged (PKCE)', accessToken: token, expiresAt: Date.now() + expiresIn * 1000, refreshToken };
            }
            case 'service-account':
                return this.runServiceAccountFlow(env, base);
            case 'manual-token': {
                const token = await vscode.window.showInputBox({ prompt: 'Paste an APS access token', password: true, ignoreFocusOut: true });
                if (!token) {
                    throw new Error('No access token provided.');
                }
                const chosenScopes = scopes.length > 0 ? scopes : authenticationService.defaultScopes;
                return { ...base, mode: { kind }, scopes: chosenScopes, label: 'manual token', accessToken: token, expiresAt: 0 };
            }
        }
    }

    private async runServiceAccountFlow(env: IEnvironment, base: { id: string; environmentKey: string }): Promise<IApsAuthSession> {
        const { secureServiceAccountsService, authenticationService } = this.getContext();

        const accounts = await withProgress('Loading secure service accounts...', secureServiceAccountsService.getServiceAccounts());
        if (accounts.length === 0) {
            throw new Error('No secure service accounts found for this application.');
        }
        const email = await vscode.window.showQuickPick(accounts.map(account => account.email), { placeHolder: 'Select secure service account', ignoreFocusOut: true });
        if (!email) {
            throw new Error('Login cancelled.');
        }
        const account = accounts.find(a => a.email === email)!;

        const keys = await withProgress('Loading keys...', secureServiceAccountsService.getServiceAccountKeys(account.id));
        if (keys.length === 0) {
            throw new Error('The selected service account has no keys.');
        }
        const keyId = await vscode.window.showQuickPick(keys.map(key => key.id), { placeHolder: 'Select key', ignoreFocusOut: true });
        if (!keyId) {
            throw new Error('Login cancelled.');
        }

        const privateKeyFile = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: `Select private key file for key ID ${keyId}`, filters: { 'PEM Files': ['pem'], 'All Files': ['*'] } });
        if (!privateKeyFile || privateKeyFile.length !== 1) {
            throw new Error('No private key file selected.');
        }
        const privateKey = Buffer.from(await vscode.workspace.fs.readFile(privateKeyFile[0])).toString('utf8');

        const scopes = await vscode.window.showQuickPick(authenticationService.defaultScopes, { canPickMany: true, placeHolder: 'Select scopes', ignoreFocusOut: true });
        if (!scopes || scopes.length === 0) {
            throw new Error('No scopes selected.');
        }

        const assertion = secureServiceAccountsService.generateJwtAssertion(env.clientId, account.id, privateKey, keyId, scopes);
        const token = await withProgress('Generating access token...', secureServiceAccountsService.exchangeJwtAssertion(assertion, env.clientId, env.clientSecret, scopes));
        const mode: ApsAuthMode = { kind: 'service-account', serviceAccountId: account.id, keyId, privateKey };
        return {
            ...base,
            mode,
            scopes,
            label: `service account: ${account.email}`,
            accessToken: token.access_token!,
            expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
        };
    }
}
