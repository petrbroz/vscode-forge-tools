import * as vscode from 'vscode';

/** Base class for the tree providers: owns the change-event emitter and the `refresh()` method. */
export abstract class BaseTreeProvider<T> implements vscode.TreeDataProvider<T> {
    protected readonly _onDidChangeTreeData = new vscode.EventEmitter<T | null>();

    readonly onDidChangeTreeData: vscode.Event<T | null> = this._onDidChangeTreeData.event;

    /** Refreshes the whole tree, or just the subtree of the given element. */
    refresh(element?: T): void {
        this._onDidChangeTreeData.fire(element || null);
    }

    abstract getTreeItem(element: T): vscode.TreeItem | Thenable<vscode.TreeItem>;
    abstract getChildren(element?: T): vscode.ProviderResult<T[]>;
}
