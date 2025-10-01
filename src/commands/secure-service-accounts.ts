import * as vscode from 'vscode';
import { createWebViewPanel, IContext, showErrorMessage, withProgress } from '../common';
import { ISecureServiceAccount, ISecureServiceAccountKey } from '../interfaces/secure-service-accounts';

export async function createSecureServiceAccount(context: IContext) {
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

export async function viewSecureServiceAccountDetails(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        // TODO: prompt to pick one
        vscode.window.showErrorMessage('No secure service account selected');
        return;
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

export async function updateSecureServiceAccount(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        // TODO: prompt to pick one
        vscode.window.showErrorMessage('No secure service account selected');
        return;
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

export async function createSecureServiceAccountKey(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        // TODO: prompt to pick one
        vscode.window.showErrorMessage('No secure service account selected');
        return;
    }

    try {
        const secureServiceAccountKey = await withProgress(
            `Generating private key for secure service account: ${secureServiceAccount.id}`,
            context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(secureServiceAccount.id).keys.post()
        );
		const doc = await vscode.workspace.openTextDocument({ content: secureServiceAccountKey?.privateKey! });
		await vscode.window.showTextDocument(doc, { preview: false });
    } catch(err) {
        showErrorMessage('Could not generate private key for secure service account', err, context);
    }
}

export async function deleteSecureServiceAccount(secureServiceAccount: ISecureServiceAccount | undefined, context: IContext) {
    if (!secureServiceAccount) {
        // TODO: prompt to pick one
        vscode.window.showErrorMessage('No secure service account selected');
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

export async function deleteSecureServiceAccountKey(secureServiceAccountKey: ISecureServiceAccountKey | undefined, context: IContext) {
    if (!secureServiceAccountKey) {
        // TODO: prompt to pick one
        vscode.window.showErrorMessage('No secure service account key selected');
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
