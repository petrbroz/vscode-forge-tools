import * as vscode from 'vscode';
import {
    AuthenticationClient,
    DataManagementClient,
    ModelDerivativeClient,
    DesignAutomationClient,
    WebhooksClient,
    BIM360Client,
    IBucket,
    IObject,
    urnify
} from 'forge-server-utils';
import { IDerivative } from './interfaces/model-derivative';
import { IAuthOptions } from 'forge-server-utils/dist/common';
import { IEnvironment } from './environments';
import { ModelDerivativeFormats, isViewableFormat } from './providers/model-derivative';

export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}

export interface IContext {
    credentials: IAuthOptions;
    environment: IEnvironment;
    extensionContext: vscode.ExtensionContext;
    authenticationClient: AuthenticationClient;
    dataManagementClient: DataManagementClient;
    modelDerivativeClient2L: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L: ModelDerivativeClient; // client for 3-legged workflows
    designAutomationClient: DesignAutomationClient;
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    previewSettings: IPreviewSettings;
    threeLeggedToken?: string;
}

export async function promptBucket(context: IContext): Promise<IBucket | undefined> {
    const buckets = await context.dataManagementClient.listBuckets();
    const bucketKey = await vscode.window.showQuickPick(buckets.map(item => item.bucketKey), { canPickMany: false, placeHolder: 'Select bucket' });
    if (!bucketKey) {
        return undefined;
    } else {
        return buckets.find(item => item.bucketKey === bucketKey);
    }
}

export async function promptObject(context: IContext, bucketKey: string): Promise<IObject | undefined> {
    const objects = await context.dataManagementClient.listObjects(bucketKey);
    const objectKey = await vscode.window.showQuickPick(objects.map(item => item.objectKey), { canPickMany: false, placeHolder: 'Select object' });
    if (!objectKey) {
        return undefined;
    } else {
        return objects.find(item => item.objectKey === objectKey);
    }
}

export async function promptDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const urn = urnify(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;
    const svf = manifest.derivatives.find((deriv: any) => isViewableFormat(deriv.outputType));
    if (!svf) {
        vscode.window.showWarningMessage(`No derivatives yet for ${urn}`);
        return undefined;
    }
    const derivatives: IDerivative[] = svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
        return {
            urn: urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            bubble: geometry
        };
    });

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: 'Select derivative' });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

export async function promptCustomDerivative(context: IContext, objectId: string, formats: ModelDerivativeFormats): Promise<IDerivative | undefined> {
    const urn = urnify(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;

    const derivatives: IDerivative[] = manifest.derivatives
        .find((deriv: any) => formats.hasOutput(deriv.outputType))
        .filter((deriv: any) => !isViewableFormat(deriv.outputType))
        .flatMap((deriv: any) => deriv.children.filter((child: any) => child.role === deriv.outputType))
        .map((resource: any) => {
            const fileUrn: string = resource.urn;
            const filePathParts = fileUrn.split("/");


            return {
                urn,
                name: filePathParts[filePathParts.length - 1],
                role: resource.role,
                guid: resource.guid,
                format: resource.role,
                bubble: {
                    fileUrn
                }
            }
        });

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: 'Select derivative' });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

export async function promptAppBundleFullID(context: IContext): Promise<string | undefined> {
    const appBundles = await context.designAutomationClient.listAppBundles();
    return vscode.window.showQuickPick(appBundles.filter(id => !id.endsWith('$LATEST')), { canPickMany: false, placeHolder: 'Select app bundle' });
}

export async function promptEngine(context: IContext): Promise<string | undefined> {
    const engines = await context.designAutomationClient.listEngines();
    return vscode.window.showQuickPick(engines, { canPickMany: false, placeHolder: 'Select engine' });
}

export async function showErrorMessage(title: string, err: any) {
    let msg = title;
    if (typeof err === 'string') {
        msg += ': ' + err;
    } else if (typeof err === 'object') {
        if (err.message) {
            msg += ': ' + err.message;
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

export function inHubs(urn: string): boolean {
    return urn.indexOf('_') !== -1;
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
                render(document.getElementById('root'), JSON.parse('${JSON.stringify(props)}'));
            </script>
        </body>
        </html>
    `;
    return panel;
}