import * as vscode from 'vscode';
import { IContext } from '../common';
import { EntryType, ISecureServiceAccount, ISecureServiceAccountKey } from '../models/secure-service-accounts';

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
            case EntryType.SecureServiceAccount: {
                const node = new vscode.TreeItem(entry.email, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = entry.id;
                node.tooltip = [
                    `Secure Service Account`,
                    `ID: ${entry.id}`,
                    `E-mail: ${entry.email}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('account');
                return node;
            }
            case EntryType.SecureServiceAccountKey: {
                const node = new vscode.TreeItem(entry.id, vscode.TreeItemCollapsibleState.None);
                node.id = entry.id;
                node.tooltip = [
                    `Secure Service Account Key`,
                    `ID: ${entry.id}`,
                    `Status: ${entry.status}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('key');
                return node;
            }
        }
    }

    async getChildren(entry?: SecureServiceAccountsEntry | undefined): Promise<SecureServiceAccountsEntry[]> {
        if (!entry) {
            return this.getSecureServiceAccounts();
        }

        switch (entry.type) {
            case EntryType.SecureServiceAccount:
                return this.getSecureServiceAccountKeys(entry.id);
            case EntryType.SecureServiceAccountKey:
                return [];
        }
    }

    protected async getSecureServiceAccounts(): Promise<ISecureServiceAccount[]> {
        return this.context.secureServiceAccountsService.getServiceAccounts();
    }

    protected async getSecureServiceAccountKeys(accountId: string): Promise<ISecureServiceAccountKey[]> {
        return this.context.secureServiceAccountsService.getServiceAccountKeys(accountId);
    }
}
