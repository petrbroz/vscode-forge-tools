import * as vscode from 'vscode';

/** URI scheme backing virtual, read-only documents (JSON details, reports, generated secrets). */
export const READONLY_SCHEME = 'aps-readonly';

/** Builds a stable `aps-readonly:` URI for the given path segments, so the same resource always reopens the same document instead of a new "Untitled" tab. */
export function readOnlyUri(...pathSegments: string[]): vscode.Uri {
    return vscode.Uri.from({ scheme: READONLY_SCHEME, path: '/' + pathSegments.map(encodeURIComponent).join('/') });
}

/**
 * Backs virtual read-only documents with in-memory content instead of temp files or "Untitled" buffers.
 * Opening the same URI again updates its content in place and reveals the existing tab.
 */
export class ReadOnlyContentProvider implements vscode.TextDocumentContentProvider {
    private readonly content = new Map<string, string>();
    private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.content.get(uri.toString()) ?? '';
    }

    async open(uri: vscode.Uri, content: string): Promise<void> {
        const isUpdate = this.content.has(uri.toString());
        this.content.set(uri.toString(), content);
        if (isUpdate) {
            this.onDidChangeEmitter.fire(uri);
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
    }
}
