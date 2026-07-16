import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { IContext, withProgress } from './common';
import { IEnvironment } from './models/environment';
import { ApsAuthMode, ApsAuthModeKind, IApsAuthSession } from './models/authentication';

const DefaultAuthPort = 8123;

interface IModeQuickPickItem extends vscode.QuickPickItem {
    authMode: ApsAuthModeKind;
}

/**
 * VS Code authentication provider for Autodesk Platform Services. Owns the single active user-context
 * session per environment: `createSession` runs a quick-pick over the sign-in modes (3-legged OAuth,
 * PKCE, Secure Service Account, pasted token), drives the chosen flow via the domain services, and
 * persists the resulting {@link IApsAuthSession} - including any secret material needed to refresh or
 * re-mint the token - to `context.secrets`, keyed per environment so it survives a window reload.
 *
 * This is vscode glue: it imports `vscode` and the domain services (via the `IContext` accessor) but
 * never `@aps_sdk/*` - token minting/refresh lives entirely in the services layer.
 */
export class ApsAuthenticationProvider implements vscode.AuthenticationProvider {
    static readonly id = 'aps';
    static readonly label = 'Autodesk Platform Services';

    private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;

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
            { authMode: 'authorization-code', label: '$(sign-in) 3-legged OAuth', detail: 'Interactive browser login using your APS app client ID and secret (confidential client).' },
            { authMode: 'authorization-code-pkce', label: '$(sign-in) 3-legged OAuth with PKCE', detail: 'Interactive browser login for public clients, without a client secret.' },
            { authMode: 'service-account', label: '$(robot) Secure Service Account', detail: 'Sign in on behalf of a secure service account using its private key.' },
            { authMode: 'manual-token', label: '$(key) Paste access token', detail: 'Use an access token obtained from another APS application.' }
        ];
        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select an APS authentication method', ignoreFocusOut: true });
        return picked?.authMode;
    }

    private getPort(): number {
        return vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.authentication.port') || DefaultAuthPort;
    }

    private openBrowser = (url: string) => {
        vscode.env.openExternal(vscode.Uri.parse(url));
    };

    private async runModeFlow(env: IEnvironment, kind: ApsAuthModeKind, scopes: string[]): Promise<IApsAuthSession> {
        const { authenticationService } = this.getContext();
        const base = { id: randomUUID(), environmentKey: env.clientId };
        switch (kind) {
            case 'authorization-code': {
                const { token, expiresIn, refreshToken } = await authenticationService.login(env.clientId, this.getPort(), this.openBrowser);
                return { ...base, mode: { kind }, scopes: authenticationService.defaultScopes, label: '3-legged', accessToken: token, expiresAt: Date.now() + expiresIn * 1000, refreshToken };
            }
            case 'authorization-code-pkce': {
                const { token, expiresIn, refreshToken } = await authenticationService.loginWithPkce(env.clientId, this.getPort(), this.openBrowser);
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
