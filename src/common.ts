import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { BucketsItems, ObjectDetails } from './models/oss';
import { urnify } from './urn';
import { IDerivative } from './models/model-derivative';
import { IEnvironment } from './models/environment';
import { IApsAuthSession } from './models/authentication';
import { IServices } from './services';
import { readOnlyUri, ReadOnlyContentProvider } from './providers/readonly-content';

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
    /** Backs the virtual, read-only documents (JSON details, reports, generated secrets) opened via {@link showReadOnlyJson}/{@link showReadOnlyText}. */
    readOnlyContentProvider: ReadOnlyContentProvider;
}

/** Key into `workspaceState` for the most recently selected OSS bucket, remembered per workspace. */
const LAST_BUCKET_KEY = 'aps.lastBucket';

export async function promptBucket(context: IContext): Promise<BucketsItems | undefined> {
    const buckets = await withProgress(vscode.l10n.t('Loading buckets...'), context.ossService.getAllBuckets(context.environment.region));
    const lastBucketKey = context.extensionContext.workspaceState.get<string>(LAST_BUCKET_KEY);
    const bucketKey = await vscode.window.showQuickPick(sortRecentFirst(buckets.map(item => item.bucketKey), lastBucketKey), { canPickMany: false, placeHolder: vscode.l10n.t('Select bucket') });
    if (!bucketKey) {
        return undefined;
    } else {
        await context.extensionContext.workspaceState.update(LAST_BUCKET_KEY, bucketKey);
        return buckets.find(item => item.bucketKey === bucketKey);
    }
}

export async function promptObject(context: IContext, bucketKey: string): Promise<ObjectDetails | undefined> {
    const objects = await withProgress(vscode.l10n.t('Loading objects...'), context.ossService.getAllObjects(bucketKey));
    const objectKey = await vscode.window.showQuickPick(objects.map(item => item.objectKey!), { canPickMany: false, placeHolder: vscode.l10n.t('Select object') });
    if (!objectKey) {
        return undefined;
    } else {
        return objects.find(item => item.objectKey === objectKey);
    }
}

export async function promptDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const derivatives = await withProgress(vscode.l10n.t('Loading derivatives...'), context.modelDerivativeService.getViewableDerivatives(objectId));
    if (!derivatives) {
        vscode.window.showWarningMessage(vscode.l10n.t('No derivatives yet for {0}', urnify(objectId)));
        return undefined;
    }

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: vscode.l10n.t('Select derivative') });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

export async function promptCustomDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const derivatives = await withProgress(vscode.l10n.t('Loading derivatives...'), context.modelDerivativeService.getCustomDerivatives(objectId));

    const derivativeName = await vscode.window.showQuickPick(derivatives.map(item => item.name), { canPickMany: false, placeHolder: vscode.l10n.t('Select derivative') });
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
}

/** Keys into `globalState` for the most recently selected app bundle/engine, remembered across workspaces. */
const LAST_APP_BUNDLE_KEY = 'aps.lastAppBundle';
const LAST_ENGINE_KEY = 'aps.lastEngine';

export async function promptAppBundleFullID(context: IContext): Promise<string | undefined> {
    const appBundles = await withProgress(vscode.l10n.t('Loading app bundles...'), context.designAutomationService.getAvailableAppBundles());
    const lastAppBundle = context.extensionContext.globalState.get<string>(LAST_APP_BUNDLE_KEY);
    const appBundle = await vscode.window.showQuickPick(sortRecentFirst(appBundles, lastAppBundle), { canPickMany: false, placeHolder: vscode.l10n.t('Select app bundle') });
    if (appBundle) {
        await context.extensionContext.globalState.update(LAST_APP_BUNDLE_KEY, appBundle);
    }
    return appBundle;
}

export async function promptEngine(context: IContext): Promise<string | undefined> {
    const engines = await withProgress(vscode.l10n.t('Loading engines...'), context.designAutomationService.listEngines());
    const lastEngine = context.extensionContext.globalState.get<string>(LAST_ENGINE_KEY);
    const engine = await vscode.window.showQuickPick(sortRecentFirst(engines, lastEngine), { canPickMany: false, placeHolder: vscode.l10n.t('Select engine') });
    if (engine) {
        await context.extensionContext.globalState.update(LAST_ENGINE_KEY, engine);
    }
    return engine;
}

/** Moves `recent` to the front of `items` (if present) so the most recently used choice is offered first in a quick pick. */
function sortRecentFirst(items: string[], recent: string | undefined): string[] {
    if (!recent || !items.includes(recent)) {
        return items;
    }
    return [recent, ...items.filter(item => item !== recent)];
}

/** Extracts a human-readable error message from an API error response body, if there is one. */
export function getApiErrorMessage(data: any): string | undefined {
    if (data === undefined || data === null) {
        return undefined;
    }
    if (typeof data === 'string') {
        return data.trim() || undefined;
    }
    if (Array.isArray(data)) {
        const messages = data.map(getApiErrorMessage).filter(Boolean);
        return messages.length > 0 ? messages.join('; ') : undefined;
    }
    if (typeof data === 'object') {
        for (const key of ['detail', 'developerMessage', 'errorMessage', 'message', 'messages', 'reason', 'diagnostic', 'error_description', 'errors', 'error', 'title']) {
            const message = getApiErrorMessage(data[key]);
            if (message) {
                return message;
            }
        }
    }
    return undefined;
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
    } else if (err && typeof err === 'object') {
        if (err.message) {
            msg += ': ' + err.message;
        } else if (err.detail) {
            msg += ': ' + err.detail;
        }
    }

    // Errors thrown by the @aps_sdk/* clients wrap the original axios error (and its response) in `axiosError`.
    const response = err?.response ?? err?.axiosError?.response;
    const apiMessage = getApiErrorMessage(response?.data);
    if (apiMessage && !msg.includes(apiMessage)) {
        msg += ` (${apiMessage})`;
    }

    if (response) {
        const showDetails = vscode.l10n.t('Show Details');
        const answer = await vscode.window.showErrorMessage(msg, showDetails);
        if (answer === showDetails) {
            const raw = {
                // Only include the request method and URL; the full request config may contain the access token.
                config: response.config ? { method: response.config.method, url: response.config.url } : undefined,
                data: response.data,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText
            };
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(raw, null, 4), language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    } else {
        await vscode.window.showErrorMessage(msg);
    }
}

/**
 * Registers a command whose handler's errors are reported via `showErrorMessage` using `errorTitle`.
 * When `errorTitle` is omitted, the handler is registered as-is.
 */
export function command(context: IContext, id: string, handler: (...args: any[]) => any): vscode.Disposable;
export function command(context: IContext, id: string, errorTitle: string, handler: (...args: any[]) => any): vscode.Disposable;
export function command(context: IContext, id: string, titleOrHandler: string | ((...args: any[]) => any), maybeHandler?: (...args: any[]) => any): vscode.Disposable {
    if (typeof titleOrHandler === 'function') {
        return vscode.commands.registerCommand(id, titleOrHandler);
    }
    const handler = maybeHandler!;
    return vscode.commands.registerCommand(id, async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch (err) {
            showErrorMessage(titleOrHandler, err, context);
        }
    });
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Returns a comparator that sorts items by the given property using natural, case-insensitive string ordering. */
export function stringPropertySorter<T>(propName: keyof T) {
    return (a: T, b: T): number => collator.compare(String(a[propName] ?? ''), String(b[propName] ?? ''));
}

/** Converts a VS Code cancellation token to an `AbortSignal` that aborts when cancellation is requested. */
export function toAbortSignal(token: vscode.CancellationToken): AbortSignal {
    const controller = new AbortController();
    if (token.isCancellationRequested) {
        controller.abort();
    } else {
        token.onCancellationRequested(() => controller.abort());
    }
    return controller.signal;
}

/** Whether `err` was caused by a user-initiated cancellation (aborted request or polling). */
export function isCancellation(err: unknown): boolean {
    return err instanceof Error && (err.name === 'AbortError');
}

export function withProgress<T>(title: string, task: Thenable<T>): Thenable<T> {
    return vscode.window.withProgress<T>({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
    }, () => task);
}

/** Opens (or reveals/updates, if already open) a read-only virtual document showing `data` as formatted JSON. `pathSegments` must uniquely identify the underlying resource so re-opening it reuses the same tab. */
export function showReadOnlyJson(context: IContext, pathSegments: string[], data: unknown): Thenable<void> {
    return context.readOnlyContentProvider.open(withExtension(pathSegments, 'json'), JSON.stringify(data, null, 4));
}

/** Opens (or reveals/updates, if already open) a read-only virtual document showing `content` as plain text. `pathSegments` must uniquely identify the underlying resource so re-opening it reuses the same tab. */
export function showReadOnlyText(context: IContext, pathSegments: string[], content: string): Thenable<void> {
    return context.readOnlyContentProvider.open(withExtension(pathSegments, 'txt'), content);
}

function withExtension(pathSegments: string[], extension: string): vscode.Uri {
    return readOnlyUri(...pathSegments.slice(0, -1), `${pathSegments[pathSegments.length - 1]}.${extension}`);
}

/** Pinned version of the APS Viewer; update on release. */
export const VIEWER_VERSION = '7.110.0';

export function createWebViewPanel<Props, Message = unknown>(context: IContext, scriptName: string, id: string, title: string, props: Props, onMessage?: (message: Message) => void, options?: { viewer?: boolean }): vscode.WebviewPanel {
    const viewer = !!options?.viewer;
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
    const nonce = randomUUID();
    let csp: string;
    let headExtras = '';
    let bootstrap: string;
    if (viewer) {
        const viewerBase = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}`;
        const cspSource = panel.webview.cspSource;
        csp = [
            `default-src 'none'`,
            `script-src 'nonce-${nonce}' ${cspSource} https://developer.api.autodesk.com 'unsafe-eval'`,
            `style-src ${cspSource} https://developer.api.autodesk.com 'unsafe-inline'`,
            `img-src ${cspSource} data: blob: https://*.api.autodesk.com`,
            `connect-src https://*.api.autodesk.com https://*.autodesk.com data: blob:`,
            `font-src ${cspSource} https://developer.api.autodesk.com data:`,
            `worker-src blob: https://developer.api.autodesk.com`,
            `child-src blob:`,
            `media-src data: blob:`
        ].join('; ');
        headExtras = /*html*/ `
            <link rel="stylesheet" href="${viewerBase}/style.css">
            <script nonce="${nonce}" src="${viewerBase}/viewer3D.js"></script>
            <style>
                body { margin: 0; }
                #root { position: absolute; inset: 0; }
            </style>`;
        const encodedProps = Buffer.from(JSON.stringify(props)).toString('base64');
        bootstrap = `const decodedProps = JSON.parse(atob('${encodedProps}'));
                render(document.getElementById('root'), decodedProps);`;
    } else {
        csp = `default-src 'none'; script-src 'nonce-${nonce}'; img-src data:`;
        bootstrap = `render(document.getElementById('root'), ${JSON.stringify(props)});`;
    }
    panel.webview.html = /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp}">${headExtras}
            <title>${title}</title>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" nonce="${nonce}">
                import { render } from '${scriptUri}';
                ${bootstrap}
            </script>
        </body>
        </html>
    `;
    return panel;
}

/** Result of a single step in a multi-step flow. */
export type StepResult = 'next' | 'back' | 'cancel';

/**
 * Runs a sequence of steps, letting the user go back to a previous step (using the Back button
 * of quick picks/input boxes) without restarting the whole flow. Returns true if all steps completed.
 */
export async function runMultiStep(steps: ((index: number, total: number) => Thenable<StepResult>)[]): Promise<boolean> {
    let i = 0;
    while (i < steps.length) {
        const result = await steps[i](i, steps.length);
        if (result === 'cancel') {
            return false;
        }
        i = result === 'back' ? Math.max(0, i - 1) : i + 1;
    }
    return true;
}

function stepTitle(title: string, index: number, total: number): string {
    return total > 1 ? `${title} (${index + 1}/${total})` : title;
}

/** Shows a single-selection quick pick as a step; the Back button is shown for all but the first step. */
export function pickStep(title: string, index: number, total: number, items: string[], placeHolder: string, onPick: (value: string) => void): Promise<StepResult> {
    return new Promise<StepResult>(resolve => {
        const input = vscode.window.createQuickPick<vscode.QuickPickItem>();
        let result: StepResult = 'cancel';
        input.title = stepTitle(title, index, total);
        input.placeholder = placeHolder;
        input.items = items.map(label => ({ label }));
        input.ignoreFocusOut = true;
        if (index > 0) {
            input.buttons = [vscode.QuickInputButtons.Back];
        }
        input.onDidTriggerButton(button => {
            if (button === vscode.QuickInputButtons.Back) {
                result = 'back';
                input.hide();
            }
        });
        input.onDidAccept(() => {
            const selected = input.selectedItems[0];
            if (selected) {
                onPick(selected.label);
                result = 'next';
                input.hide();
            }
        });
        input.onDidHide(() => {
            input.dispose();
            resolve(result);
        });
        input.show();
    });
}

/** Shows an input box as a step; the Back button is shown for all but the first step. */
export function inputStep(title: string, index: number, total: number, prompt: string, value: string, onInput: (value: string) => void, options?: { allowEmpty?: boolean }): Promise<StepResult> {
    return new Promise<StepResult>(resolve => {
        const input = vscode.window.createInputBox();
        let result: StepResult = 'cancel';
        input.title = stepTitle(title, index, total);
        input.prompt = prompt;
        input.value = value;
        input.ignoreFocusOut = true;
        if (index > 0) {
            input.buttons = [vscode.QuickInputButtons.Back];
        }
        input.onDidTriggerButton(button => {
            if (button === vscode.QuickInputButtons.Back) {
                result = 'back';
                input.hide();
            }
        });
        input.onDidAccept(() => {
            if (!options?.allowEmpty && !input.value) {
                return;
            }
            onInput(input.value);
            result = 'next';
            input.hide();
        });
        input.onDidHide(() => {
            input.dispose();
            resolve(result);
        });
        input.show();
    });
}

/** Like `promptEngine`, but as a step of a multi-step flow. */
export async function promptEngineStep(context: IContext, title: string, index: number, total: number, onPick: (engine: string) => void): Promise<StepResult> {
    const engines = await withProgress(vscode.l10n.t('Loading engines...'), context.designAutomationService.listEngines());
    const lastEngine = context.extensionContext.globalState.get<string>(LAST_ENGINE_KEY);
    return pickStep(title, index, total, sortRecentFirst(engines, lastEngine), 'Select engine', engine => {
        void context.extensionContext.globalState.update(LAST_ENGINE_KEY, engine);
        onPick(engine);
    });
}
