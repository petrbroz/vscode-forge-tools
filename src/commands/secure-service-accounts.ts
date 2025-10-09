import * as vscode from 'vscode';
import jwt from 'jsonwebtoken';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { EntryType, ISecureServiceAccount, ISecureServiceAccountKey } from '../interfaces/secure-service-accounts';
import { CommandCategory, Command, CommandRegistry, ViewTitleMenu, ViewItemContextMenu } from './shared';
import { DefaultScopes } from './authentication';

@CommandCategory({ category: 'Autodesk Platform Services > Secure Service Accounts', prefix: 'aps.ssa' })
export class SecureServiceAccountsCommands extends CommandRegistry {
    constructor(protected context: IContext, protected refresh: () => void) {
        super();
    }

    @Command({ title: 'Refresh Secure Service Accounts', icon: 'refresh' })
    @ViewTitleMenu({ when: 'view == apsSecureServiceAccountsView', group: 'navigation' })
    async refreshAccounts() {
        this.refresh();
    }

    @Command({ title: 'Create Secure Service Account', icon: 'add' })
    @ViewTitleMenu({ when: 'view == apsSecureServiceAccountsView', group: 'navigation' })
    async createAccount() {
        const name = await vscode.window.showInputBox({ prompt: 'Enter secure service account username' });
        if (!name) {
            return;
        }
        const firstName = await vscode.window.showInputBox({ prompt: 'Enter secure service account first name' });
        if (!firstName) {
            return;
        }
        const lastName = await vscode.window.showInputBox({ prompt: 'Enter secure service account last name' });
        if (!lastName) {
            return;
        }

        try {
            const account = await this.context.secureServiceAccountsClient.serviceAccounts.post({ name, firstName, lastName });
            vscode.window.showInformationMessage(`Secure service account created: ${account?.email}`);
        } catch (error) {
            showErrorMessage('Could not create secure service account', error, this.context);
        }
    }

    @Command({ title: 'View Secure Service Account Details', icon: 'open-preview' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account'", group: '0_view@1' })
    async viewAccountDetails(secureServiceAccount: ISecureServiceAccount | undefined) {
        if (!secureServiceAccount) {
            secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
        }

        try {
            const secureServiceAccountDetails = await withProgress(
                `Getting secure service account details: ${secureServiceAccount.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).get()
            );
            createWebViewPanel(this.context, 'secure-service-account-details.js', 'secure-service-account-details', `Secure Service Account Details: ${secureServiceAccount.id}`, { detail: secureServiceAccountDetails });
        } catch (err) {
            showErrorMessage('Could not retrieve secure service account details', err, this.context);
        }
    }

    @Command({ title: 'Copy Secure Service Account ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account'", group: '1_action@1' })
    async copyAccountID(secureServiceAccount: ISecureServiceAccount | undefined) {
        if (!secureServiceAccount) {
            secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
        }
        await vscode.env.clipboard.writeText(secureServiceAccount.id);
        vscode.window.showInformationMessage(`Secure service account ID copied to clipboard: ${secureServiceAccount.id}`);
    }

    @Command({ title: 'Update Secure Service Account', icon: 'edit' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account'", group: '2_modify' })
    async updateAccount(secureServiceAccount: ISecureServiceAccount | undefined) {
        if (!secureServiceAccount) {
            secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
        }

        const status = await vscode.window.showQuickPick(['ENABLED', 'DISABLED'], { placeHolder: `Select new status for secure service account: ${secureServiceAccount.id}` });
        if (status !== 'ENABLED' && status !== 'DISABLED') {
            return;
        }

        try {
            await withProgress(
                `Updating secure service account: ${secureServiceAccount.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).patch({ status })
            );
            vscode.window.showInformationMessage(`Secure service account updated: ${secureServiceAccount.id}`);
        } catch (err) {
            showErrorMessage('Could not update secure service account', err, this.context);
        }
    }

    @Command({ title: 'Delete Secure Service Account', icon: 'trash' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account'", group: '3_remove' })
    async deleteAccount(secureServiceAccount: ISecureServiceAccount | undefined) {
        if (!secureServiceAccount) {
            secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
        }

        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete secure service account: ${secureServiceAccount.id}? This action cannot be undone.`, { modal: true }, 'Delete');
        if (confirm !== 'Delete') {
            return;
        }

        try {
            await withProgress(
                `Deleting secure service account: ${secureServiceAccount.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).delete()
            );
            vscode.window.showInformationMessage(`Secure service account deleted: ${secureServiceAccount.id}`);
        } catch (err) {
            showErrorMessage('Could not delete secure service account', err, this.context);
        }
    }

    @Command({ title: 'Create Secure Service Account Key', icon: 'add' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account'", group: '1_action@2' })
    async createAccountKey(secureServiceAccount: ISecureServiceAccount | undefined) {
        if (!secureServiceAccount) {
            secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
        }

        try {
            const secureServiceAccountKey = await withProgress(
                `Generating private key for secure service account: ${secureServiceAccount.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).keys.post()
            );
            const doc = await vscode.workspace.openTextDocument({ content: secureServiceAccountKey?.privateKey! });
            await vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showWarningMessage(`Make sure to copy the private key as it will not be shown again!`);
        } catch (err) {
            showErrorMessage('Could not generate private key for secure service account', err, this.context);
        }
    }

    @Command({ title: 'View Secure Service Account Key Details', icon: 'open-preview' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '0_view@1' })
    async viewAccountKeyDetails(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }

        try {
            const allSecureServiceAccountKeys = await withProgress(
                `Getting secure service account key details: ${secureServiceAccountKey.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccountKey.secureServiceAccountId).keys.get()
            );
            const secureServiceAccountDetails = allSecureServiceAccountKeys?.keys?.find(key => key.kid === secureServiceAccountKey!.id);
            if (!secureServiceAccountDetails) {
                vscode.window.showErrorMessage(`Could not find secure service account key details: ${secureServiceAccountKey.id}`);
                return;
            }
            createWebViewPanel(this.context, 'secure-service-account-key-details.js', 'secure-service-account-key-details', `Secure Service Account Key Details: ${secureServiceAccountDetails.kid}`, { detail: secureServiceAccountDetails });
        } catch (err) {
            showErrorMessage('Could not retrieve secure service account key details', err, this.context);
        }
    }

    @Command({ title: 'Copy Secure Service Account Key ID to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '1_action@1' })
    async copyAccountKeyID(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }
        await vscode.env.clipboard.writeText(secureServiceAccountKey.id);
        vscode.window.showInformationMessage(`Secure service account key ID copied to clipboard: ${secureServiceAccountKey.id}`);
    }

    @Command({ title: 'Update Secure Service Account Key', icon: 'edit' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '2_modify' })
    async updateAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }

        const status = await vscode.window.showQuickPick(['ENABLED', 'DISABLED'], { placeHolder: `Select new status for secure service account key: ${secureServiceAccountKey.id}` });
        if (status !== 'ENABLED' && status !== 'DISABLED') {
            return;
        }

        try {
            const { id, secureServiceAccountId } = secureServiceAccountKey;
            await withProgress(
                `Updating secure service account key: ${id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccountId).keys.byKeyId(id).patch({ status })
            );
            vscode.window.showInformationMessage(`Secure service account key updated: ${id}`);
        } catch (err) {
            showErrorMessage('Could not update secure service account key', err, this.context);
        }
    }

    @Command({ title: 'Delete Secure Service Account Key', icon: 'trash' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '3_remove' })
    async deleteAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }

        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete secure service account key: ${secureServiceAccountKey.id}? This action cannot be undone.`, { modal: true }, 'Delete');
        if (confirm !== 'Delete') {
            return;
        }

        try {
            await withProgress(
                `Deleting secure service account key: ${secureServiceAccountKey.id}`,
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccountKey.secureServiceAccountId).keys.byKeyId(secureServiceAccountKey.id).delete()
            );
            vscode.window.showInformationMessage(`Secure service account key deleted: ${secureServiceAccountKey.id}`);
        } catch (err) {
            showErrorMessage('Could not delete secure service account key', err, this.context);
        }
    }

    @Command({ title: 'Generate Assertion', icon: 'gist-secret' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '1_action@3' })
    async generateAssertion(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }

        const privateKeyFile = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: `Select Private Key File For Key ID ${secureServiceAccountKey.id}`, filters: { 'PEM Files': ['pem'], 'All Files': ['*'] } });
        if (!privateKeyFile || privateKeyFile.length !== 1) {
            return;
        }
        const privateKeyBuffer = await vscode.workspace.fs.readFile(privateKeyFile[0]);
        const privateKey = Buffer.from(privateKeyBuffer).toString('utf8');

        const scopes = await vscode.window.showQuickPick(DefaultScopes, { canPickMany: true, placeHolder: 'Select scopes', ignoreFocusOut: true, });
        if (!scopes || scopes.length === 0) {
            vscode.window.showErrorMessage('No scopes provided');
            return;
        }

        const assertion = this.createAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            secureServiceAccountKey.id,
            privateKey,
            scopes
        );
        const action = await vscode.window.showInformationMessage('Assertion generated', 'Open in New Tab', 'Copy to Clipboard');
        switch (action) {
            case 'Open in New Tab':
                const doc = await vscode.workspace.openTextDocument({ content: assertion });
                await vscode.window.showTextDocument(doc, { preview: false });
                break;
            case 'Copy to Clipboard':
                await vscode.env.clipboard.writeText(assertion);
                break;
        }
    }

    @Command({ title: 'Generate Access Token', icon: 'key' })
    @ViewItemContextMenu({ when: "view == apsSecureServiceAccountsView && viewItem == 'secure-service-account-key'", group: '1_action@2' })
    async generateAccessToken(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        if (!secureServiceAccountKey) {
            secureServiceAccountKey = await this.promptSecureServiceAccountKey();
            if (!secureServiceAccountKey) {
                return;
            }
        }

        const privateKeyFile = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: `Select Private Key File For Key ID ${secureServiceAccountKey.id}`, filters: { 'PEM Files': ['pem'], 'All Files': ['*'] } });
        if (!privateKeyFile || privateKeyFile.length !== 1) {
            return;
        }
        const privateKeyBuffer = await vscode.workspace.fs.readFile(privateKeyFile[0]);
        const privateKey = Buffer.from(privateKeyBuffer).toString('utf8');

        const scopes = await vscode.window.showQuickPick(DefaultScopes, { canPickMany: true, placeHolder: 'Select scopes', ignoreFocusOut: true, });
        if (!scopes || scopes.length === 0) {
            vscode.window.showErrorMessage('No scopes provided');
            return;
        }

        const assertion = this.createAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            secureServiceAccountKey.id,
            privateKey,
            scopes
        );
        const accessToken = await withProgress(
            'Generating access token...',
            this.exchangeAssertionForAccessToken(
                this.context.environment.clientId,
                this.context.environment.clientSecret,
                assertion,
                scopes
            )
        );
        const action = await vscode.window.showInformationMessage('Access token generated', 'Open in New Tab', 'Copy to Clipboard');
        switch (action) {
            case 'Open in New Tab':
                const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(accessToken, null, 2), language: 'json' });
                await vscode.window.showTextDocument(doc, { preview: false });
                break;
            case 'Copy to Clipboard':
                await vscode.env.clipboard.writeText(JSON.stringify(accessToken, null, 2));
                break;
        }
    }

    protected async promptSecureServiceAccount(): Promise<ISecureServiceAccount | undefined> {
        // TODO: reuse SecureServiceAccountsDataProvider here
        try {
            const secureServiceAccounts = await withProgress(
                'Loading secure service accounts...',
                this.context.secureServiceAccountsClient.serviceAccounts.get()
            );
            if (!secureServiceAccounts || !secureServiceAccounts.serviceAccounts || secureServiceAccounts.serviceAccounts.length === 0) {
                vscode.window.showInformationMessage('No secure service accounts found');
                return;
            }
            const options = secureServiceAccounts.serviceAccounts.map(account => account.email!);
            const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select secure service account' });
            if (selected) {
                const account = secureServiceAccounts.serviceAccounts.find(account => account.email === selected)!;
                return {
                    type: EntryType.SecureServiceAccount,
                    id: account.serviceAccountId!,
                    email: account.email!
                };
            } else {
                vscode.window.showInformationMessage('No secure service account selected');
                return;
            }
        } catch (error) {
            showErrorMessage('Could not load secure service accounts', error, this.context);
        }
    }

    protected async promptSecureServiceAccountKey(): Promise<ISecureServiceAccountKey | undefined> {
        // TODO: reuse SecureServiceAccountsDataProvider here
        try {
            const secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
            const secureServiceAccountKeys = await withProgress(
                'Loading secure service account keys...',
                this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).keys.get()
            );
            if (!secureServiceAccountKeys || !secureServiceAccountKeys.keys || secureServiceAccountKeys.keys.length === 0) {
                vscode.window.showInformationMessage('No secure service account keys found');
                return;
            }
            const options = secureServiceAccountKeys.keys.map(key => key.kid!);
            const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select secure service account key' });
            if (selected) {
                const key = secureServiceAccountKeys.keys.find(key => key.kid === selected)!;
                return {
                    type: EntryType.SecureServiceAccountKey,
                    id: selected,
                    status: key.status!,
                    secureServiceAccountId: secureServiceAccount.id,
                };
            } else {
                vscode.window.showInformationMessage('No secure service account key selected');
                return;
            }
        } catch (error) {
            showErrorMessage('Could not load secure service account keys', error, this.context);
        }
    }

    protected createAssertion(clientId: string, serviceAccountId: string, serviceAccountKeyId: string, serviceAccountPrivateKey: string, scopes: string[], host: string = 'https://developer.api.autodesk.com'): string {
        const payload = {
            iss: clientId,
            sub: serviceAccountId,
            aud: `${host}/authentication/v2/token`,
            exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            scope: scopes
        };
        return jwt.sign(payload, serviceAccountPrivateKey, {
            algorithm: 'RS256',
            header: {
                alg: 'RS256',
                kid: serviceAccountKeyId
            },
            noTimestamp: true
        });
    }

    protected async exchangeAssertionForAccessToken(clientId: string, clientSecret: string, assertion: string, scopes: string[], host: string = 'https://developer.api.autodesk.com'): Promise<{ access_token: string; token_type: string; expires_in: number; }> {
        const headers = {
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const body = new URLSearchParams({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'scope': scopes.join(' '),
            'assertion': assertion
        });
        const response = await fetch(`${host}/authentication/v2/token`, { method: 'POST', headers, body });
        if (!response.ok) {
            throw new Error(`Could not generate access token: ${await response.text()}`);
        }
        return response.json();
    }
}
