import * as fs from 'fs';
import * as path from 'path';
import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { DesignAutomationRegion } from '../models/environment';
import { PAGINATION_TOKEN_PAGING, RestClient } from './rest-client';
import {
    DesignAutomationID,
    IActivityDetail,
    IActivityParam,
    IAlias,
    IAppBundleDetail,
    IAppBundleUploadParams,
    ICodeOnEngineStringSetting,
    ICodeOnEngineUrlSetting,
    IWorkItemDetail,
    IWorkItemParam
} from '../models/design-automation-api';

// Re-export the Design Automation types + ID helper so consumers (commands/providers) have a single
// import site, mirroring how the legacy SDK client exposed both the client and its types.
export { DesignAutomationID };
export type {
    IActivityDetail,
    IActivityParam,
    IAlias,
    IAppBundleDetail,
    IAppBundleUploadParams,
    ICodeOnEngineStringSetting,
    ICodeOnEngineUrlSetting,
    IWorkItemDetail,
    IWorkItemParam
};

const DEFAULT_HOST = 'https://developer.api.autodesk.com';
export const DESIGN_AUTOMATION_SCOPES = ['code:all'];

type ActivitySettings = { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting };

/** Owner (nickname) plus the unique, owner-scoped IDs of the app bundles/activities they own. */
export interface IOwnedItems {
    nickname: string;
    ids: string[];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(signal.reason);
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal!.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Domain logic for the Design Automation v3 API. There is no official `@aps_sdk/*` SDK for Design
 * Automation, so this is built on the shared {@link RestClient}. Two-legged tokens (`code:all`) come from
 * the authentication provider; list endpoints are auto-paginated to plain arrays. On top of the REST calls
 * it adds domain logic (owner/`$LATEST` filtering, app bundle archive uploads, work item polling and
 * report retrieval) so the vscode layers never touch `DesignAutomationID` parsing or `fetch`/`fs` directly.
 */
export class DesignAutomationService {
    private readonly rest: RestClient;
    private _nickname: Promise<string> | null = null;

    constructor(authenticationProvider: IAuthenticationProvider, host?: string, region?: DesignAutomationRegion) {
        this.rest = new RestClient(`${host || DEFAULT_HOST}/da/${region || DesignAutomationRegion.US_EAST}/v3`, authenticationProvider, DESIGN_AUTOMATION_SCOPES);
    }

    private listAll<T>(path: string): Promise<T[]> {
        return this.rest.getAllPages<T>(path, PAGINATION_TOKEN_PAGING);
    }

    private aliasBody(version: number, receiver?: string): any {
        const body: any = { version };
        if (receiver) {
            body.receiver = receiver;
        }
        return body;
    }

    // General

    /** Returns the current app's nickname (`/forgeapps/me` responds with plain text). */
    getNickname(): Promise<string> {
        return this.rest.request<string>({ method: 'GET', url: '/forgeapps/me' });
    }

    /** The current app's nickname, fetched once and cached for the lifetime of this service instance. */
    private getCachedNickname(): Promise<string> {
        if (this._nickname === null) {
            this._nickname = this.getNickname().catch(err => {
                this._nickname = null;
                throw err;
            });
        }
        return this._nickname;
    }

    /** Splits full IDs into ones owned by `nickname` (deduped, bare IDs) and ones shared (full IDs). */
    private static splitByOwner(fullIds: string[], nickname: string): { ownedIds: string[]; sharedFullIds: string[] } {
        const parsed = fullIds.map(DesignAutomationID.parse).filter((item): item is DesignAutomationID => item !== null);
        const ownedIds = Array.from(new Set(parsed.filter(item => item.owner === nickname).map(item => item.id)));
        const sharedFullIds = parsed.filter(item => item.owner !== nickname).map(item => item.toString());
        return { ownedIds, sharedFullIds };
    }

    /** Lists every available engine, in the order returned by the API (for populating UI pickers). */
    listEngines(): Promise<string[]> {
        return this.listAll<string>('/engines');
    }

    /** Lists every available engine, sorted alphabetically (for the create/update activity views). */
    async findAvailableEngines(): Promise<string[]> {
        const engines = await this.listEngines();
        return engines.sort();
    }

    // App bundles

    /** Lists every app bundle full ID, unfiltered (for populating UI pickers). */
    listAppBundles(): Promise<string[]> {
        return this.listAll<string>('/appbundles');
    }

    /** Lists app bundle full IDs excluding the `$LATEST` pseudo-versions (for the activity views). */
    async getAvailableAppBundles(): Promise<string[]> {
        const appBundles = await this.listAppBundles();
        return appBundles.filter(id => !id.endsWith('$LATEST'));
    }

    /** Returns the unique IDs of app bundles owned by the current app, plus its nickname. */
    async getOwnedAppBundles(): Promise<IOwnedItems> {
        const nickname = await this.getCachedNickname();
        const appBundleIDs = await this.listAppBundles();
        const { ownedIds } = DesignAutomationService.splitByOwner(appBundleIDs, nickname);
        return { nickname, ids: ownedIds };
    }

    /** Returns the full IDs of app bundles shared with (but not owned by) the current app. */
    async getSharedAppBundles(): Promise<string[]> {
        const nickname = await this.getCachedNickname();
        const appBundleIDs = await this.listAppBundles();
        return DesignAutomationService.splitByOwner(appBundleIDs, nickname).sharedFullIds;
    }

    getAppBundle(id: string): Promise<IAppBundleDetail> {
        return this.rest.request<IAppBundleDetail>({ method: 'GET', url: `/appbundles/${id}` });
    }

    getAppBundleVersion(name: string, version: number): Promise<IAppBundleDetail> {
        return this.rest.request<IAppBundleDetail>({ method: 'GET', url: `/appbundles/${name}/versions/${version}` });
    }

    createAppBundle(name: string, engine: string, description: string): Promise<IAppBundleUploadParams> {
        return this.rest.request<IAppBundleUploadParams>({ method: 'POST', url: '/appbundles', data: { id: name, engine, description } });
    }

    updateAppBundle(name: string, engine: string, description: string): Promise<IAppBundleUploadParams> {
        return this.rest.request<IAppBundleUploadParams>({ method: 'POST', url: `/appbundles/${name}/versions`, data: { engine, description } });
    }

    /** Uploads an app bundle archive from a local file path to the signed URL in `details`. */
    async uploadAppBundleArchive(details: IAppBundleUploadParams, filePath: string): Promise<void> {
        const { endpointURL, formData } = details.uploadParameters;
        const form = new FormData();
        for (const [key, value] of Object.entries(formData)) {
            form.append(key, value);
        }
        form.append('file', await fs.openAsBlob(filePath), path.basename(filePath)); // The archive must be the last field
        // The endpoint URL is a pre-signed S3 upload, not on the APS host - no base URL, no bearer token.
        const response = await fetch(endpointURL, { method: 'POST', body: form });
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
    }

    async deleteAppBundle(id: string): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/appbundles/${id}` });
    }

    listAppBundleVersions(id: string): Promise<number[]> {
        return this.listAll<number>(`/appbundles/${id}/versions`);
    }

    async deleteAppBundleVersion(id: string, version: number): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/appbundles/${id}/versions/${version}` });
    }

    listAppBundleAliases(id: string): Promise<IAlias[]> {
        return this.listAll<IAlias>(`/appbundles/${id}/aliases`);
    }

    /** Lists an app bundle's aliases excluding the `$LATEST` pseudo-alias (for the tree view). */
    async getAppBundleAliases(id: string): Promise<IAlias[]> {
        const aliases = await this.listAppBundleAliases(id);
        return aliases.filter(alias => alias.id !== '$LATEST');
    }

    createAppBundleAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.rest.request<IAlias>({ method: 'POST', url: `/appbundles/${id}/aliases`, data: { id: alias, ...this.aliasBody(version, receiver) } });
    }

    updateAppBundleAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.rest.request<IAlias>({ method: 'PATCH', url: `/appbundles/${id}/aliases/${alias}`, data: this.aliasBody(version, receiver) });
    }

    async deleteAppBundleAlias(id: string, alias: string): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/appbundles/${id}/aliases/${alias}` });
    }

    // Activities

    listActivities(): Promise<string[]> {
        return this.listAll<string>('/activities');
    }

    /** Returns the unique IDs of activities owned by the current app, plus its nickname. */
    async getOwnedActivities(): Promise<IOwnedItems> {
        const nickname = await this.getCachedNickname();
        const activityIDs = await this.listActivities();
        const { ownedIds } = DesignAutomationService.splitByOwner(activityIDs, nickname);
        return { nickname, ids: ownedIds };
    }

    /** Returns the full IDs of activities shared with (but not owned by) the current app. */
    async getSharedActivities(): Promise<string[]> {
        const nickname = await this.getCachedNickname();
        const activityIDs = await this.listActivities();
        return DesignAutomationService.splitByOwner(activityIDs, nickname).sharedFullIds;
    }

    getActivity(id: string): Promise<IActivityDetail> {
        return this.rest.request<IActivityDetail>({ method: 'GET', url: `/activities/${id}` });
    }

    getActivityVersion(name: string, version: number): Promise<IActivityDetail> {
        return this.rest.request<IActivityDetail>({ method: 'GET', url: `/activities/${name}/versions/${version}` });
    }

    createActivity(id: string, engine: string, commands: string[], appBundles: string[], parameters: { [key: string]: IActivityParam }, settings: ActivitySettings, description: string): Promise<IActivityDetail> {
        return this.rest.request<IActivityDetail>({ method: 'POST', url: '/activities', data: { id, commandLine: commands, engine, appbundles: appBundles, parameters, settings, description } });
    }

    updateActivity(id: string, engine: string, commands: string[], appBundles: string[], parameters: { [key: string]: IActivityParam }, settings: ActivitySettings, description: string): Promise<IActivityDetail> {
        return this.rest.request<IActivityDetail>({ method: 'POST', url: `/activities/${id}/versions`, data: { commandLine: commands, engine, appbundles: appBundles, parameters, settings, description } });
    }

    async deleteActivity(id: string): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/activities/${id}` });
    }

    listActivityVersions(id: string): Promise<number[]> {
        return this.listAll<number>(`/activities/${id}/versions`);
    }

    async deleteActivityVersion(id: string, version: number): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/activities/${id}/versions/${version}` });
    }

    listActivityAliases(id: string): Promise<IAlias[]> {
        return this.listAll<IAlias>(`/activities/${id}/aliases`);
    }

    /** Lists an activity's aliases excluding the `$LATEST` pseudo-alias (for the tree view). */
    async getActivityAliases(id: string): Promise<IAlias[]> {
        const aliases = await this.listActivityAliases(id);
        return aliases.filter(alias => alias.id !== '$LATEST');
    }

    createActivityAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.rest.request<IAlias>({ method: 'POST', url: `/activities/${id}/aliases`, data: { id: alias, ...this.aliasBody(version, receiver) } });
    }

    updateActivityAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.rest.request<IAlias>({ method: 'PATCH', url: `/activities/${id}/aliases/${alias}`, data: this.aliasBody(version, receiver) });
    }

    async deleteActivityAlias(id: string, alias: string): Promise<void> {
        await this.rest.request<void>({ method: 'DELETE', url: `/activities/${id}/aliases/${alias}` });
    }

    // Work items

    createWorkItem(activityId: string, parameters: { [key: string]: IWorkItemParam }): Promise<IWorkItemDetail> {
        return this.rest.request<IWorkItemDetail>({ method: 'POST', url: '/workitems', data: { activityId, arguments: parameters } });
    }

    getWorkItem(id: string): Promise<IWorkItemDetail> {
        return this.rest.request<IWorkItemDetail>({ method: 'GET', url: `/workitems/${id}` });
    }

    /**
     * Polls a work item every 5 seconds until it leaves the `pending`/`inprogress` state, invoking
     * `onProgress` with the latest status after each poll, and returns the final work item detail.
     * Rejects if `signal` is aborted.
     */
    async waitForWorkItem(workitem: IWorkItemDetail, onProgress?: (status: string) => void, signal?: AbortSignal): Promise<IWorkItemDetail> {
        while (workitem.status === 'inprogress' || workitem.status === 'pending') {
            await sleep(5000, signal);
            workitem = await this.getWorkItem(workitem.id);
            onProgress?.(workitem.status);
        }
        return workitem;
    }

    /** Fetches the plain-text report for a (completed) work item. */
    async getWorkItemReport(workitem: IWorkItemDetail): Promise<string> {
        const response = await fetch(workitem.reportUrl);
        return response.text();
    }
}
