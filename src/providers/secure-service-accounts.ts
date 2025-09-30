import * as vscode from 'vscode';
import { IContext } from '../common';
import { ISecureServiceAccount, ISecureServiceAccountKey } from '../interfaces/secure-service-accounts';

type SecureServiceAccountsEntry = ISecureServiceAccount | ISecureServiceAccountKey;

export class SecureServiceAccountsDataProvider implements vscode.TreeDataProvider<SecureServiceAccountsEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<SecureServiceAccountsEntry | null> = new vscode.EventEmitter<SecureServiceAccountsEntry | null>();

    readonly onDidChangeTreeData?: vscode.Event<SecureServiceAccountsEntry | null> = this._onDidChangeTreeData.event;

    constructor(protected context: IContext) {
    }

    refresh(entry?: SecureServiceAccountsEntry) {
        this._onDidChangeTreeData.fire(entry || null);
    }

    getTreeItem(entry: SecureServiceAccountsEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        switch (entry.type) {
            case 'secure-service-account': {
                const node = new vscode.TreeItem(entry.email, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = entry.id;
                node.contextValue = entry.type;
                return node;
            }
            case 'secure-service-account-key': {
                const node = new vscode.TreeItem(entry.id, vscode.TreeItemCollapsibleState.None);
                node.id = entry.id;
                node.contextValue = entry.type;
                return node;
            }
        }
    }

    async getChildren(entry?: SecureServiceAccountsEntry | undefined): Promise<SecureServiceAccountsEntry[]> {
        if (!entry) {
            return this.getSecureServiceAccounts();
        }

        switch (entry.type) {
            case 'secure-service-account':
                return this.getSecureServiceAccountKeys(entry.id);
            case 'secure-service-account-key':
                return [];
        }
    }

    protected async getSecureServiceAccounts(): Promise<ISecureServiceAccount[]> {
        const response = await this.context.secureServiceAccountsClient.serviceAccounts.get();
        return (response?.serviceAccounts || []).map(account => ({
            type: 'secure-service-account',
            id: account.serviceAccountId!,
            email: account.email!,
        }));
    }

    protected async getSecureServiceAccountKeys(accountId: string): Promise<ISecureServiceAccountKey[]> {
        const response = await this.context.secureServiceAccountsClient.serviceAccounts.byServiceAccountId(accountId).keys.get();
        return (response?.keys || []).map(key => ({
            type: 'secure-service-account-key',
            id: key.kid!,
            status: key.status!,
            secureServiceAccountId: accountId,
        }));
    }
}
