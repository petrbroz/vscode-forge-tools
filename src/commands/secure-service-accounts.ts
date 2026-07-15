import * as vscode from 'vscode';
import { Scopes, Utils } from '@aps_sdk/secure-service-account';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { EntryType, ISecureServiceAccount, ISecureServiceAccountKey } from '../interfaces/secure-service-accounts';
import { DefaultScopes } from './authentication';

export class SecureServiceAccountsCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.ssa.refreshAccounts', this.refreshAccounts.bind(this)),
            vscode.commands.registerCommand('aps.ssa.createAccount', this.createAccount.bind(this)),
            vscode.commands.registerCommand('aps.ssa.viewAccountDetails', this.viewAccountDetails.bind(this)),
            vscode.commands.registerCommand('aps.ssa.copyAccountID', this.copyAccountID.bind(this)),
            vscode.commands.registerCommand('aps.ssa.updateAccount', this.updateAccount.bind(this)),
            vscode.commands.registerCommand('aps.ssa.deleteAccount', this.deleteAccount.bind(this)),
            vscode.commands.registerCommand('aps.ssa.createAccountKey', this.createAccountKey.bind(this)),
            vscode.commands.registerCommand('aps.ssa.viewAccountKeyDetails', this.viewAccountKeyDetails.bind(this)),
            vscode.commands.registerCommand('aps.ssa.copyAccountKeyID', this.copyAccountKeyID.bind(this)),
            vscode.commands.registerCommand('aps.ssa.updateAccountKey', this.updateAccountKey.bind(this)),
            vscode.commands.registerCommand('aps.ssa.deleteAccountKey', this.deleteAccountKey.bind(this)),
            vscode.commands.registerCommand('aps.ssa.generateAssertion', this.generateAssertion.bind(this)),
            vscode.commands.registerCommand('aps.ssa.generateAccessToken', this.generateAccessToken.bind(this)),
        ];
    }

    async refreshAccounts() {
        this.refresh();
    }

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
            const account = await this.context.secureServiceAccountsClient.createServiceAccount({ name, firstName, lastName });
            vscode.window.showInformationMessage(`Secure service account created: ${account?.email}`);
        } catch (error) {
            showErrorMessage('Could not create secure service account', error, this.context);
        }
    }

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
                this.context.secureServiceAccountsClient.getServiceAccount(secureServiceAccount.id)
            );
            createWebViewPanel(this.context, 'secure-service-account-details.js', 'secure-service-account-details', `Secure Service Account Details: ${secureServiceAccount.id}`, { detail: secureServiceAccountDetails });
        } catch (err) {
            showErrorMessage('Could not retrieve secure service account details', err, this.context);
        }
    }

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
                status === 'ENABLED'
                    ? this.context.secureServiceAccountsClient.enableServiceAccount(secureServiceAccount.id)
                    : this.context.secureServiceAccountsClient.disableServiceAccount(secureServiceAccount.id)
            );
            vscode.window.showInformationMessage(`Secure service account updated: ${secureServiceAccount.id}`);
        } catch (err) {
            showErrorMessage('Could not update secure service account', err, this.context);
        }
    }

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
                this.context.secureServiceAccountsClient.deleteServiceAccount(secureServiceAccount.id)
            );
            vscode.window.showInformationMessage(`Secure service account deleted: ${secureServiceAccount.id}`);
        } catch (err) {
            showErrorMessage('Could not delete secure service account', err, this.context);
        }
    }

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
                this.context.secureServiceAccountsClient.createServiceAccountKey(secureServiceAccount.id)
            );
            const doc = await vscode.workspace.openTextDocument({ content: secureServiceAccountKey?.privateKey! });
            await vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showWarningMessage(`Make sure to copy the private key as it will not be shown again!`);
        } catch (err) {
            showErrorMessage('Could not generate private key for secure service account', err, this.context);
        }
    }

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
                this.context.secureServiceAccountsClient.getAllServiceAccountKeys(secureServiceAccountKey.secureServiceAccountId)
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
                status === 'ENABLED'
                    ? this.context.secureServiceAccountsClient.enableServiceAccountKey(secureServiceAccountId, id)
                    : this.context.secureServiceAccountsClient.disableServiceAccountKey(secureServiceAccountId, id)
            );
            vscode.window.showInformationMessage(`Secure service account key updated: ${id}`);
        } catch (err) {
            showErrorMessage('Could not update secure service account key', err, this.context);
        }
    }

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
                this.context.secureServiceAccountsClient.deleteServiceAccountKey(secureServiceAccountKey.secureServiceAccountId, secureServiceAccountKey.id)
            );
            vscode.window.showInformationMessage(`Secure service account key deleted: ${secureServiceAccountKey.id}`);
        } catch (err) {
            showErrorMessage('Could not delete secure service account key', err, this.context);
        }
    }

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

        const assertion = Utils.generateJwtAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            privateKey,
            secureServiceAccountKey.id,
            scopes as Scopes[]
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

        const assertion = Utils.generateJwtAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            privateKey,
            secureServiceAccountKey.id,
            scopes as Scopes[]
        );
        const accessToken = await withProgress(
            'Generating access token...',
            this.context.secureServiceAccountsClient.exchangeJwtAssertion(
                assertion,
                this.context.environment.clientId,
                this.context.environment.clientSecret,
                { scope: scopes as Scopes[] }
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
                this.context.secureServiceAccountsClient.getServiceAccounts()
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
                this.context.secureServiceAccountsClient.getAllServiceAccountKeys(secureServiceAccount.id)
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
}
