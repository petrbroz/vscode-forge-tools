import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { ISecureServiceAccount, ISecureServiceAccountKey } from '../models/secure-service-accounts';

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
            const email = await this.context.secureServiceAccountsService.createServiceAccount(name, firstName, lastName);
            vscode.window.showInformationMessage(`Secure service account created: ${email}`);
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
                this.context.secureServiceAccountsService.getServiceAccountDetails(secureServiceAccount.id)
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
                    ? this.context.secureServiceAccountsService.enableServiceAccount(secureServiceAccount.id)
                    : this.context.secureServiceAccountsService.disableServiceAccount(secureServiceAccount.id)
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
                this.context.secureServiceAccountsService.deleteServiceAccount(secureServiceAccount.id)
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
            const privateKey = await withProgress(
                `Generating private key for secure service account: ${secureServiceAccount.id}`,
                this.context.secureServiceAccountsService.createServiceAccountKey(secureServiceAccount.id)
            );
            const doc = await vscode.workspace.openTextDocument({ content: privateKey! });
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
            const secureServiceAccountDetails = await withProgress(
                `Getting secure service account key details: ${secureServiceAccountKey.id}`,
                this.context.secureServiceAccountsService.getServiceAccountKeyDetails(secureServiceAccountKey.secureServiceAccountId, secureServiceAccountKey.id)
            );
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
                    ? this.context.secureServiceAccountsService.enableServiceAccountKey(secureServiceAccountId, id)
                    : this.context.secureServiceAccountsService.disableServiceAccountKey(secureServiceAccountId, id)
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
                this.context.secureServiceAccountsService.deleteServiceAccountKey(secureServiceAccountKey.secureServiceAccountId, secureServiceAccountKey.id)
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

        const scopes = await vscode.window.showQuickPick(this.context.authenticationService.defaultScopes, { canPickMany: true, placeHolder: 'Select scopes', ignoreFocusOut: true, });
        if (!scopes || scopes.length === 0) {
            vscode.window.showErrorMessage('No scopes provided');
            return;
        }

        const assertion = this.context.secureServiceAccountsService.generateJwtAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            privateKey,
            secureServiceAccountKey.id,
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

        const scopes = await vscode.window.showQuickPick(this.context.authenticationService.defaultScopes, { canPickMany: true, placeHolder: 'Select scopes', ignoreFocusOut: true, });
        if (!scopes || scopes.length === 0) {
            vscode.window.showErrorMessage('No scopes provided');
            return;
        }

        const assertion = this.context.secureServiceAccountsService.generateJwtAssertion(
            this.context.environment.clientId,
            secureServiceAccountKey.secureServiceAccountId,
            privateKey,
            secureServiceAccountKey.id,
            scopes
        );
        const accessToken = await withProgress(
            'Generating access token...',
            this.context.secureServiceAccountsService.exchangeJwtAssertion(
                assertion,
                this.context.environment.clientId,
                this.context.environment.clientSecret,
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
        try {
            const secureServiceAccounts = await withProgress(
                'Loading secure service accounts...',
                this.context.secureServiceAccountsService.getServiceAccounts()
            );
            if (secureServiceAccounts.length === 0) {
                vscode.window.showInformationMessage('No secure service accounts found');
                return;
            }
            const options = secureServiceAccounts.map(account => account.email);
            const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select secure service account' });
            if (selected) {
                return secureServiceAccounts.find(account => account.email === selected)!;
            } else {
                vscode.window.showInformationMessage('No secure service account selected');
                return;
            }
        } catch (error) {
            showErrorMessage('Could not load secure service accounts', error, this.context);
        }
    }

    protected async promptSecureServiceAccountKey(): Promise<ISecureServiceAccountKey | undefined> {
        try {
            const secureServiceAccount = await this.promptSecureServiceAccount();
            if (!secureServiceAccount) {
                return;
            }
            const secureServiceAccountKeys = await withProgress(
                'Loading secure service account keys...',
                this.context.secureServiceAccountsService.getServiceAccountKeys(secureServiceAccount.id)
            );
            if (secureServiceAccountKeys.length === 0) {
                vscode.window.showInformationMessage('No secure service account keys found');
                return;
            }
            const options = secureServiceAccountKeys.map(key => key.id);
            const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select secure service account key' });
            if (selected) {
                return secureServiceAccountKeys.find(key => key.id === selected)!;
            } else {
                vscode.window.showInformationMessage('No secure service account key selected');
                return;
            }
        } catch (error) {
            showErrorMessage('Could not load secure service account keys', error, this.context);
        }
    }
}
