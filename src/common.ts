import * as vscode from 'vscode';
import { BucketsItems, ObjectDetails } from './models/oss';
import { urnify } from './urn';
import { IDerivative } from './models/model-derivative';
import { IEnvironment } from './models/environment';
import { IApsAuthSession } from './models/authentication';
import { IServices } from './services';

export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}

export interface IContext extends IServices {
    environment: IEnvironment;
    extensionContext: vscode.ExtensionContext;
    previewSettings: IPreviewSettings;
    /** The active user-context session, or `undefined` when running 2-legged (app identity) only. */
    session?: IApsAuthSession;
    log: vscode.LogOutputChannel;
}

export async function promptBucket(context: IContext): Promise<BucketsItems | undefined> {
    const buckets = await context.ossService.getAllBuckets();
    const bucketKey = await vscode.window.showQuickPick(buckets.map(item => item.bucketKey), { canPickMany: false, placeHolder: 'Select bucket' });
    if (!bucketKey) {
        return undefined;
    } else {
        return buckets.find(item => item.bucketKey === bucketKey);
    }
}

export async function promptObject(context: IContext, bucketKey: string): Promise<ObjectDetails | undefined> {
    const objects = await context.ossService.getAllObjects(bucketKey);
    const objectKey = await vscode.window.showQuickPick(objects.map(item => item.objectKey!), { canPickMany: false, placeHolder: 'Select object' });
    if (!objectKey) {
        return undefined;
    } else {
        return objects.find(item => item.objectKey === objectKey);
    }
}

export async function promptDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const derivatives = await context.modelDerivativeService.getViewableDerivatives(objectId);
    if (!derivatives) {
        vscode.window.showWarningMessage(`No derivatives yet for ${urnify(objectId)}`);
        return undefined;
    }

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: 'Select derivative' });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

export async function promptCustomDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const derivatives = await context.modelDerivativeService.getCustomDerivatives(objectId);

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: 'Select derivative' });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

export async function promptAppBundleFullID(context: IContext): Promise<string | undefined> {
    const appBundles = await context.designAutomationService.getAvailableAppBundles();
    return vscode.window.showQuickPick(appBundles, { canPickMany: false, placeHolder: 'Select app bundle' });
}

export async function promptEngine(context: IContext): Promise<string | undefined> {
    const engines = await context.designAutomationService.listEngines();
    return vscode.window.showQuickPick(engines, { canPickMany: false, placeHolder: 'Select engine' });
}

export async function showErrorMessage(title: string, err: any, context?: IContext) {
    if (context) {
        context.log.error(title);
        if (err) {
            context.log.error(err);
        }
    }

    let msg = title;
    if (typeof err === 'string') {
        msg += ': ' + err;
    } else if (typeof err === 'object') {
        if (err.message) {
            msg += ': ' + err.message;
        } else if (err.detail) {
            msg += ': ' + err.detail;
        }
    }

    if (err.response) {
        const answer = await vscode.window.showErrorMessage(msg, 'Show Details');
        if (answer === 'Show Details') {
            const raw = {
                config: err.response.config,
                data: err.response.data,
                headers: err.response.headers,
                status: err.response.status,
                statusText: err.response.statusText
            };
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(raw, null, 4), language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    } else {
        await vscode.window.showErrorMessage(msg);
    }
}

export function stringPropertySorter<T>(propName: keyof T) {
    return function (a: T, b: T): number {
        if (a[propName] < b[propName]) { return -1; }
        else if (a[propName] > b[propName]) { return +1; }
        else { return 0; }
    };
}

export function withProgress<T>(title: string, task: Thenable<T>): Thenable<T> {
    return vscode.window.withProgress<T>({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
    }, (progress, token) => task);
};

export function createWebViewPanel<Props>(context: IContext, scriptName: string, id: string, title: string, props: Props, onMessage?: (message: any) => void): vscode.WebviewPanel {
    let disposables: vscode.Disposable[] = [];
    let panel = vscode.window.createWebviewPanel(id, title, vscode.ViewColumn.One, {
        enableScripts: true, // Enable javascript in the webview
        localResourceRoots: [vscode.Uri.joinPath(context.extensionContext.extensionUri, 'out')], // Restrict the webview to only load resources from the `out` directory
        retainContextWhenHidden: true
    });
    panel.onDidDispose(() => {
        while (disposables.length) {
            const disposable = disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        panel.dispose();
    }, null, disposables);
    if (onMessage) {
        panel.webview.onDidReceiveMessage(onMessage, undefined, disposables);
    }
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionContext.extensionUri, 'out', 'webviews', scriptName));
    const nonce = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    panel.webview.html = /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; img-src data:">
            <title>${title}</title>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" nonce="${nonce}">
                import { render } from '${scriptUri}';
                render(document.getElementById('root'), ${JSON.stringify(props)});
            </script>
        </body>
        </html>
    `;
    return panel;
}

export function createViewerWebViewPanel<Props>(context: IContext, scriptName: string, id: string, title: string, props: Props, onMessage?: (message: any) => void): vscode.WebviewPanel {
    let disposables: vscode.Disposable[] = [];
    let panel = vscode.window.createWebviewPanel(id, title, vscode.ViewColumn.One, {
        enableScripts: true // Enable javascript in the webview
    });
    panel.onDidDispose(() => {
        while (disposables.length) {
            const disposable = disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        panel.dispose();
    }, null, disposables);
    if (onMessage) {
        panel.webview.onDidReceiveMessage(onMessage, undefined, disposables);
    }
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionContext.extensionUri, 'out', 'webviews', scriptName));
    const nonce = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const encodedProps = Buffer.from(JSON.stringify(props)).toString('base64');
    panel.webview.html = /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <link rel="stylesheet" href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css">
            <script src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.js"></script>
            <title>${title}</title>
            <style>
                body { margin: 0; }
                #root { position: absolute; inset: 0; }
            </style>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" nonce="${nonce}">
                import { render } from '${scriptUri}';
                const decodedProps = JSON.parse(atob('${encodedProps}'));
                render(document.getElementById('root'), decodedProps);
            </script>
        </body>
        </html>
    `;
    return panel;
}