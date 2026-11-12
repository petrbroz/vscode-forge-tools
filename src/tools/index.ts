import * as vscode from 'vscode';
import * as path from 'path';
import { IContext } from '../common';
import { ObjectDetails } from '../models/oss';
import { svf2 } from '../models/model-derivative';
import { WebhookAuthContext } from '../models/webhooks';
import { WEBHOOKS } from '../services/webhooks-catalog';
import { webhooksServiceFor } from '../providers/webhooks';

export interface IBucketInput { bucketKey: string; }
export interface ICreateBucketInput { bucketKey: string; policyKey?: string; }
export interface IObjectInput { bucketKey: string; objectKey: string; }
export interface IUploadFileInput { bucketKey: string; filePath: string; objectKey?: string; }
export interface IListWebhookEventsInput { system?: string; }
export interface ICreateWebhookInput {
    system: string;
    event: string;
    callbackUrl: string;
    scopeValue: string;
    scopeKey?: string;
    filter?: string;
    authContext?: WebhookAuthContext;
}

/** Wraps a plain value into a language model tool result (strings as-is, everything else as JSON). */
function result(data: unknown): vscode.LanguageModelToolResult {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

/** Resolves a (possibly workspace-relative) file path to an absolute file system path. */
export function resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        throw new Error(`Cannot resolve relative path "${filePath}" without an open workspace folder; provide an absolute path instead.`);
    }
    return path.join(folder.uri.fsPath, filePath);
}

/**
 * Language model tools (https://code.visualstudio.com/api/extension-guides/tools) for operating on APS
 * resources from agent mode in VS Code chat. Tool names, descriptions, and input schemas are declared
 * in `package.json` under `contributes.languageModelTools`, and must be kept in sync with this class.
 * Tools with side effects ask the user for confirmation before running.
 */
export class ApsLanguageModelTools {
    constructor(
        protected context: IContext,
        protected refreshOss: () => void,
        protected refreshWebhooks: () => void
    ) {}

    registerTools(): vscode.Disposable[] {
        const env = () => this.context.environment.title;
        return [
            vscode.lm.registerTool<{}>('aps_listBuckets', {
                prepareInvocation: () => ({ invocationMessage: 'Listing APS buckets' }),
                invoke: () => this.listBuckets()
            }),
            vscode.lm.registerTool<ICreateBucketInput>('aps_createBucket', {
                prepareInvocation: ({ input }) => ({
                    invocationMessage: `Creating APS bucket ${input.bucketKey}`,
                    confirmationMessages: {
                        title: 'Create APS bucket',
                        message: new vscode.MarkdownString(`Create bucket \`${input.bucketKey}\` with retention policy \`${input.policyKey || 'transient'}\` in environment **${env()}**?`)
                    }
                }),
                invoke: ({ input }) => this.createBucket(input)
            }),
            vscode.lm.registerTool<IBucketInput>('aps_listObjects', {
                prepareInvocation: ({ input }) => ({ invocationMessage: `Listing objects in APS bucket ${input.bucketKey}` }),
                invoke: ({ input }) => this.listObjects(input)
            }),
            vscode.lm.registerTool<IUploadFileInput>('aps_uploadFile', {
                prepareInvocation: ({ input }) => ({
                    invocationMessage: `Uploading ${input.filePath} to APS bucket ${input.bucketKey}`,
                    confirmationMessages: {
                        title: 'Upload file to APS bucket',
                        message: new vscode.MarkdownString(`Upload \`${input.filePath}\` to bucket \`${input.bucketKey}\` as \`${input.objectKey || path.basename(input.filePath)}\` in environment **${env()}**?`)
                    }
                }),
                invoke: ({ input }) => this.uploadFile(input)
            }),
            vscode.lm.registerTool<IObjectInput>('aps_translateObject', {
                prepareInvocation: ({ input }) => ({
                    invocationMessage: `Starting translation of ${input.objectKey}`,
                    confirmationMessages: {
                        title: 'Translate APS object',
                        message: new vscode.MarkdownString(`Start an SVF2 translation of \`${input.objectKey}\` from bucket \`${input.bucketKey}\` in environment **${env()}**? Existing derivatives will be replaced.`)
                    }
                }),
                invoke: ({ input }) => this.translateObject(input)
            }),
            vscode.lm.registerTool<IObjectInput>('aps_getTranslationStatus', {
                prepareInvocation: ({ input }) => ({ invocationMessage: `Getting translation status of ${input.objectKey}` }),
                invoke: ({ input }) => this.getTranslationStatus(input)
            }),
            vscode.lm.registerTool<IListWebhookEventsInput>('aps_listWebhookEvents', {
                prepareInvocation: () => ({ invocationMessage: 'Listing APS webhook events' }),
                invoke: ({ input }) => this.listWebhookEvents(input)
            }),
            vscode.lm.registerTool<ICreateWebhookInput>('aps_createWebhook', {
                prepareInvocation: ({ input }) => ({
                    invocationMessage: `Creating APS webhook for ${input.system}/${input.event}`,
                    confirmationMessages: {
                        title: 'Create APS webhook',
                        message: new vscode.MarkdownString(`Create a webhook (${input.authContext === 'user' ? 'user' : 'app'} context) for event \`${input.event}\` of system \`${input.system}\` with callback URL \`${input.callbackUrl}\` in environment **${env()}**?`)
                    }
                }),
                invoke: ({ input }) => this.createWebhook(input)
            })
        ];
    }

    async listBuckets(): Promise<vscode.LanguageModelToolResult> {
        const buckets = await this.context.ossService.getAllBuckets(this.context.environment.region);
        return result(buckets.map(({ bucketKey, policyKey, createdDate }) => ({ bucketKey, policyKey, createdDate })));
    }

    async createBucket({ bucketKey, policyKey }: ICreateBucketInput): Promise<vscode.LanguageModelToolResult> {
        const policy = policyKey || 'transient';
        const policies = this.context.ossService.retentionPolicies;
        if (!policies.includes(policy)) {
            throw new Error(`Unknown retention policy "${policy}"; use one of: ${policies.join(', ')}.`);
        }
        const bucket = await this.context.ossService.createBucket(this.context.environment.region as string, bucketKey, policy);
        this.refreshOss();
        return result(bucket);
    }

    async listObjects({ bucketKey }: IBucketInput): Promise<vscode.LanguageModelToolResult> {
        const objects = await this.context.ossService.getAllObjects(bucketKey);
        return result(objects.map(({ objectKey, objectId, size }) => ({ objectKey, objectId, size })));
    }

    async uploadFile({ bucketKey, filePath, objectKey }: IUploadFileInput): Promise<vscode.LanguageModelToolResult> {
        const fullPath = resolveFilePath(filePath);
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
        if (stat.type & vscode.FileType.Directory) {
            throw new Error(`"${fullPath}" is a directory; only individual files can be uploaded.`);
        }
        const object = await this.context.ossService.uploadObject(bucketKey, objectKey || path.basename(fullPath), fullPath);
        this.refreshOss();
        return result(object);
    }

    async translateObject({ bucketKey, objectKey }: IObjectInput): Promise<vscode.LanguageModelToolResult> {
        const object = await this.context.ossService.getObjectDetails(bucketKey, objectKey) as ObjectDetails;
        const formats = await this.context.modelDerivativeService.getSupportedOutputFormats(object);
        if (!formats.includes(svf2)) {
            throw new Error(`The Model Derivative service does not support translating "${objectKey}" to SVF2.`);
        }
        await this.context.modelDerivativeService.translateToSvf2(object);
        this.refreshOss();
        return result({ urn: this.context.modelDerivativeService.getObjectUrn(object), status: 'Translation started' });
    }

    async getTranslationStatus({ bucketKey, objectKey }: IObjectInput): Promise<vscode.LanguageModelToolResult> {
        const object = await this.context.ossService.getObjectDetails(bucketKey, objectKey) as ObjectDetails;
        const { urn, status, progress, derivatives } = await this.context.modelDerivativeService.getObjectManifest(object);
        return result({
            urn,
            status,
            progress,
            derivatives: (derivatives ?? []).map(({ outputType, status, progress }) => ({ outputType, status, progress }))
        });
    }

    async listWebhookEvents({ system }: IListWebhookEventsInput): Promise<vscode.LanguageModelToolResult> {
        const systems = system ? WEBHOOKS.filter(item => item.id === system) : WEBHOOKS;
        if (systems.length === 0) {
            throw new Error(`Unknown webhook system "${system}"; use one of: ${WEBHOOKS.map(item => item.id).join(', ')}.`);
        }
        return result(systems.map(({ id, name, events }) => ({ system: id, name, events })));
    }

    async createWebhook(input: ICreateWebhookInput): Promise<vscode.LanguageModelToolResult> {
        const { system, event, callbackUrl, scopeValue, filter } = input;
        const authContext: WebhookAuthContext = input.authContext === 'user' ? 'user' : 'app';
        const _system = WEBHOOKS.find(item => item.id === system);
        if (!_system) {
            throw new Error(`Unknown webhook system "${system}"; use the aps_listWebhookEvents tool to find valid systems and events.`);
        }
        const _event = _system.events.find(item => item.id === event);
        if (!_event) {
            throw new Error(`Unknown event "${event}" for webhook system "${system}"; use the aps_listWebhookEvents tool to find valid events.`);
        }
        const scopeKey = input.scopeKey || _event.scopes[0];
        if (!_event.scopes.includes(scopeKey)) {
            throw new Error(`Unsupported scope "${scopeKey}" for event "${event}"; use one of: ${_event.scopes.join(', ')}.`);
        }
        if (authContext === 'user' && !this.context.session) {
            throw new Error('Creating a webhook in the user context requires signing in to APS first.');
        }
        await webhooksServiceFor(this.context, authContext).createWebhook(system, event, { callbackUrl, scopeKey, scopeValue, filter });
        this.refreshWebhooks();
        return result(`Webhook created for event "${event}" of system "${system}" (scope ${scopeKey}: ${scopeValue}, callback URL: ${callbackUrl}).`);
    }
}
