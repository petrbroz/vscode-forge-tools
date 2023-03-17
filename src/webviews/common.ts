// @ts-ignore
const vscode = acquireVsCodeApi();

export function postMessage<T>(message: T): void {
    vscode.postMessage(message);
}