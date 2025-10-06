import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { EntryType, ISecureServiceAccount, ISecureServiceAccountKey } from '../interfaces/secure-service-accounts';

export function registerSecureServiceAccountsCommands(context: IContext, refresh: () => void) {
    vscode.commands.registerCommand('forge.refreshSecureServiceAccounts', () => {
        refresh();
    });

    vscode.commands.registerCommand('forge.createSecureServiceAccount', async () => {
        await createSecureServiceAccount(context);
        refresh();
    });
    vscode.commands.registerCommand('forge.viewSecureServiceAccountDetails', async (secureServiceAccount?: ISecureServiceAccount) => {
        await viewSecureServiceAccountDetails(secureServiceAccount, context);
    });
    vscode.commands.registerCommand('forge.updateSecureServiceAccount', async (secureServiceAccount?: ISecureServiceAccount) => {
        await updateSecureServiceAccount(secureServiceAccount, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.deleteSecureServiceAccount', async (secureServiceAccount?: ISecureServiceAccount) => {
        await deleteSecureServiceAccount(secureServiceAccount, context);
        refresh();
    });

    vscode.commands.registerCommand('forge.createSecureServiceAccountKey', async (secureServiceAccount?: ISecureServiceAccount) => {
        await createSecureServiceAccountKey(secureServiceAccount, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.updateSecureServiceAccountKey', async (secureServiceAccountKey?: ISecureServiceAccountKey) => {  
        await updateSecureServiceAccountKey(secureServiceAccountKey, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.deleteSecureServiceAccountKey', async (secureServiceAccountKey?: ISecureServiceAccountKey) => {
        await deleteSecureServiceAccountKey(secureServiceAccountKey, context);
        refresh();
    });
}

async function promptSecureServiceAccount(context: IContext): Promise<ISecureServiceAccount | undefined> {
    // TODO: reuse SecureServiceAccountsDataProvider here
    try {
        const secureServiceAccounts = await withProgress(
            'Loading secure service accounts...',
            context.secureServiceAccountsClient.serviceAccounts.get()
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
        showErrorMessage('Could not load secure service accounts', error, context);
    }
}

async function promptSecureServiceAccountKey(context: IContext): Promise<ISecureServiceAccountKey | undefined> {
    // TODO: reuse SecureServiceAccountsDataProvider here
    try {
        const secureServiceAccount = await promptSecureServiceAccount(context);
        if (!secureServiceAccount) {
            return;
        }
        const secureServiceAccountKeys = await withProgress(
            'Loading secure service account keys...',
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).keys.get()
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
        showErrorMessage('Could not load secure service account keys', error, context);
    }
}

async function createSecureServiceAccount(context: IContext) {
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
        const account = await context.secureServiceAccountsClient.serviceAccounts.post({ name, firstName, lastName });
        vscode.window.showInformationMessage(`Secure service account created: ${account?.email}`);
    } catch (error) {
        showErrorMessage('Could not create secure service account', error, context);
    }
}

async function viewSecureServiceAccountDetails(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        secureServiceAccount = await promptSecureServiceAccount(context);
        if (!secureServiceAccount) {
            return;
        }
    }

    try {
        const secureServiceAccountDetails = await withProgress(
            `Getting secure service account details: ${secureServiceAccount.id}`,
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).get()
        );
        createWebViewPanel(context, 'secure-service-account-details.js', 'secure-service-account-details', `Secure Service Account Details: ${secureServiceAccount.id}`, { detail: secureServiceAccountDetails });
    } catch(err) {
        showErrorMessage('Could not retrieve secure service account details', err, context);
    }
}

async function updateSecureServiceAccount(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        secureServiceAccount = await promptSecureServiceAccount(context);
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
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).patch({ status })
        );
        vscode.window.showInformationMessage(`Secure service account updated: ${secureServiceAccount.id}`);
    } catch(err) {
        showErrorMessage('Could not update secure service account', err, context);
    }
}

async function deleteSecureServiceAccount(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        secureServiceAccount = await promptSecureServiceAccount(context);
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
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).delete()
        );
        vscode.window.showInformationMessage(`Secure service account deleted: ${secureServiceAccount.id}`);
    } catch(err) {
        showErrorMessage('Could not delete secure service account', err, context);
    }
}

async function createSecureServiceAccountKey(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        secureServiceAccount = await promptSecureServiceAccount(context);
        if (!secureServiceAccount) {
            return;
        }
    }

    try {
        const secureServiceAccountKey = await withProgress(
            `Generating private key for secure service account: ${secureServiceAccount.id}`,
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).keys.post()
        );
		const doc = await vscode.workspace.openTextDocument({ content: secureServiceAccountKey?.privateKey! });
		await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showWarningMessage(`Make sure to copy the private key as it will not be shown again!`);
    } catch(err) {
        showErrorMessage('Could not generate private key for secure service account', err, context);
    }
}

async function updateSecureServiceAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined, context: IContext) {
    if (!secureServiceAccountKey) {
        secureServiceAccountKey = await promptSecureServiceAccountKey(context);
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
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccountId).keys.byKeyId(id).patch({ status })
        );
        vscode.window.showInformationMessage(`Secure service account key updated: ${id}`);
    } catch(err) {
        showErrorMessage('Could not update secure service account key', err, context);
    }
}

async function deleteSecureServiceAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined, context: IContext) {
    if (!secureServiceAccountKey) {
        secureServiceAccountKey = await promptSecureServiceAccountKey(context);
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
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccountKey.secureServiceAccountId).keys.byKeyId(secureServiceAccountKey.id).delete()
        );
        vscode.window.showInformationMessage(`Secure service account key deleted: ${secureServiceAccountKey.id}`);
    } catch(err) {
        showErrorMessage('Could not delete secure service account key', err, context);
    }
}
