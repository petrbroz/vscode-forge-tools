import * as vscode from 'vscode';
import { IContext, command, showErrorMessage, showReadOnlyJson, showReadOnlyText, withProgress } from '../common';
import { ISecureServiceAccount, ISecureServiceAccountKey } from '../models/secure-service-accounts';

export class SecureServiceAccountsCommands {
    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.ssa.refreshAccounts', this.refreshAccounts.bind(this)),
            command(this.context, 'aps.ssa.createAccount', 'Could not create secure service account', this.createAccount.bind(this)),
            command(this.context, 'aps.ssa.viewAccountDetails', 'Could not retrieve secure service account details', this.viewAccountDetails.bind(this)),
            command(this.context, 'aps.ssa.copyAccountID', this.copyAccountID.bind(this)),
            command(this.context, 'aps.ssa.updateAccount', 'Could not update secure service account', this.updateAccount.bind(this)),
            command(this.context, 'aps.ssa.deleteAccount', 'Could not delete secure service account', this.deleteAccount.bind(this)),
            command(this.context, 'aps.ssa.createAccountKey', 'Could not generate private key for secure service account', this.createAccountKey.bind(this)),
            command(this.context, 'aps.ssa.viewAccountKeyDetails', 'Could not retrieve secure service account key details', this.viewAccountKeyDetails.bind(this)),
            command(this.context, 'aps.ssa.copyAccountKeyID', this.copyAccountKeyID.bind(this)),
            command(this.context, 'aps.ssa.updateAccountKey', 'Could not update secure service account key', this.updateAccountKey.bind(this)),
            command(this.context, 'aps.ssa.deleteAccountKey', 'Could not delete secure service account key', this.deleteAccountKey.bind(this)),
            command(this.context, 'aps.ssa.generateAssertion', this.generateAssertion.bind(this)),
            command(this.context, 'aps.ssa.generateAccessToken', this.generateAccessToken.bind(this)),
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

        const email = await withProgress(
            `Creating secure service account: ${name}`,
            this.context.secureServiceAccountsService.createServiceAccount(name, firstName, lastName)
        );
        vscode.window.showInformationMessage(`Secure service account created: ${email}`);
    }

    async viewAccountDetails(secureServiceAccount: ISecureServiceAccount | undefined) {
        secureServiceAccount ??= await this.promptSecureServiceAccount();
        if (!secureServiceAccount) {
            return;
        }

        const secureServiceAccountDetails = await withProgress(
            `Getting secure service account details: ${secureServiceAccount.id}`,
            this.context.secureServiceAccountsService.getServiceAccountDetails(secureServiceAccount.id)
        );
        await showReadOnlyJson(this.context, ['secure-service-accounts', secureServiceAccount.id], secureServiceAccountDetails);
    }

    async copyAccountID(secureServiceAccount: ISecureServiceAccount | undefined) {
        secureServiceAccount ??= await this.promptSecureServiceAccount();
        if (!secureServiceAccount) {
            return;
        }
        await vscode.env.clipboard.writeText(secureServiceAccount.id);
        vscode.window.showInformationMessage(`Secure service account ID copied to clipboard: ${secureServiceAccount.id}`);
    }

    async updateAccount(secureServiceAccount: ISecureServiceAccount | undefined) {
        secureServiceAccount ??= await this.promptSecureServiceAccount();
        if (!secureServiceAccount) {
            return;
        }

        const status = await vscode.window.showQuickPick(['ENABLED', 'DISABLED'], { placeHolder: `Select new status for secure service account: ${secureServiceAccount.id}` });
        if (status !== 'ENABLED' && status !== 'DISABLED') {
            return;
        }

        await withProgress(
            `Updating secure service account: ${secureServiceAccount.id}`,
            status === 'ENABLED'
                ? this.context.secureServiceAccountsService.enableServiceAccount(secureServiceAccount.id)
                : this.context.secureServiceAccountsService.disableServiceAccount(secureServiceAccount.id)
        );
        vscode.window.showInformationMessage(`Secure service account updated: ${secureServiceAccount.id}`);
    }

    async deleteAccount(secureServiceAccount: ISecureServiceAccount | undefined) {
        secureServiceAccount ??= await this.promptSecureServiceAccount();
        if (!secureServiceAccount) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete secure service account: ${secureServiceAccount.id}? This action cannot be undone.`, { modal: true }, 'Delete');
        if (confirm !== 'Delete') {
            return;
        }

        await withProgress(
            `Deleting secure service account: ${secureServiceAccount.id}`,
            this.context.secureServiceAccountsService.deleteServiceAccount(secureServiceAccount.id)
        );
        vscode.window.showInformationMessage(`Secure service account deleted: ${secureServiceAccount.id}`);
    }

    async createAccountKey(secureServiceAccount: ISecureServiceAccount | undefined) {
        secureServiceAccount ??= await this.promptSecureServiceAccount();
        if (!secureServiceAccount) {
            return;
        }

        const privateKey = await withProgress(
            `Generating private key for secure service account: ${secureServiceAccount.id}`,
            this.context.secureServiceAccountsService.createServiceAccountKey(secureServiceAccount.id)
        );
        await showReadOnlyText(this.context, ['secure-service-accounts', 'private-key', secureServiceAccount.id], privateKey!);
        vscode.window.showWarningMessage(`Make sure to copy the private key as it will not be shown again!`);
    }

    async viewAccountKeyDetails(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
        }

        const secureServiceAccountDetails = await withProgress(
            `Getting secure service account key details: ${secureServiceAccountKey.id}`,
            this.context.secureServiceAccountsService.getServiceAccountKeyDetails(secureServiceAccountKey.secureServiceAccountId, secureServiceAccountKey.id)
        );
        if (!secureServiceAccountDetails) {
            vscode.window.showErrorMessage(`Could not find secure service account key details: ${secureServiceAccountKey.id}`);
            return;
        }
        await showReadOnlyJson(this.context, ['secure-service-accounts', secureServiceAccountKey.secureServiceAccountId, 'keys', secureServiceAccountKey.id], secureServiceAccountDetails);
    }

    async copyAccountKeyID(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
        }
        await vscode.env.clipboard.writeText(secureServiceAccountKey.id);
        vscode.window.showInformationMessage(`Secure service account key ID copied to clipboard: ${secureServiceAccountKey.id}`);
    }

    async updateAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
        }

        const status = await vscode.window.showQuickPick(['ENABLED', 'DISABLED'], { placeHolder: `Select new status for secure service account key: ${secureServiceAccountKey.id}` });
        if (status !== 'ENABLED' && status !== 'DISABLED') {
            return;
        }

        const { id, secureServiceAccountId } = secureServiceAccountKey;
        await withProgress(
            `Updating secure service account key: ${id}`,
            status === 'ENABLED'
                ? this.context.secureServiceAccountsService.enableServiceAccountKey(secureServiceAccountId, id)
                : this.context.secureServiceAccountsService.disableServiceAccountKey(secureServiceAccountId, id)
        );
        vscode.window.showInformationMessage(`Secure service account key updated: ${id}`);
    }

    async deleteAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete secure service account key: ${secureServiceAccountKey.id}? This action cannot be undone.`, { modal: true }, 'Delete');
        if (confirm !== 'Delete') {
            return;
        }

        await withProgress(
            `Deleting secure service account key: ${secureServiceAccountKey.id}`,
            this.context.secureServiceAccountsService.deleteServiceAccountKey(secureServiceAccountKey.secureServiceAccountId, secureServiceAccountKey.id)
        );
        vscode.window.showInformationMessage(`Secure service account key deleted: ${secureServiceAccountKey.id}`);
    }

    async generateAssertion(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
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
                await showReadOnlyText(this.context, ['secure-service-accounts', 'assertion', secureServiceAccountKey.id], assertion);
                break;
            case 'Copy to Clipboard':
                await vscode.env.clipboard.writeText(assertion);
                break;
        }
    }

    async generateAccessToken(secureServiceAccountKey: ISecureServiceAccountKey | undefined) {
        secureServiceAccountKey ??= await this.promptSecureServiceAccountKey();
        if (!secureServiceAccountKey) {
            return;
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
                await showReadOnlyJson(this.context, ['secure-service-accounts', 'access-token', secureServiceAccountKey.id], accessToken);
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
