import * as fs from 'fs';
import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { IEnvironment, DesignAutomationRegion } from '../environment';
import { ClientCredentialsAuthenticationProvider } from './client-credentials-authentication-provider';
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
} from '../interfaces/design-automation-api';

// Re-export the Design Automation types + ID helper so consumers (commands/providers) have a single
// import site, mirroring how the legacy SDK client exposed both the client and its types.
export {
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
};

const DEFAULT_HOST = 'https://developer.api.autodesk.com';
const SCOPES = ['code:all'];

type ActivitySettings = { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting };

/**
 * Minimal REST wrapper for the APS Design Automation v3 API. There is no official `@aps_sdk/*` SDK
 * for Design Automation, so this reproduces just the method surface the extension uses, on top of
 * `axios`. Two-legged tokens (`code:all`) are obtained via the shared
 * `ClientCredentialsAuthenticationProvider`; list endpoints are auto-paginated to plain arrays to
 * match how the legacy client behaved.
 */
export class DesignAutomationClient {
    private readonly baseUrl: string;

    constructor(
        private readonly authenticationProvider: IAuthenticationProvider,
        host?: string,
        region?: DesignAutomationRegion
    ) {
        this.baseUrl = `${host || DEFAULT_HOST}/da/${region || DesignAutomationRegion.US_EAST}/v3`;
    }

    private async request<T>(config: AxiosRequestConfig): Promise<T> {
        const token = await this.authenticationProvider.getAccessToken(SCOPES);
        const response = await axios.request<T>({
            ...config,
            baseURL: this.baseUrl,
            headers: { ...config.headers, Authorization: `Bearer ${token}` }
        });
        return response.data;
    }

    /** Fetches every page of a paginated list endpoint and returns the flattened `data` array. */
    private async getPaged<T>(path: string): Promise<T[]> {
        let results: T[] = [];
        let page: string | undefined;
        do {
            const url = page ? `${path}?page=${encodeURIComponent(page)}` : path;
            const data = await this.request<{ data?: T[]; paginationToken?: string }>({ method: 'GET', url });
            if (data.data) {
                results = results.concat(data.data);
            }
            page = data.paginationToken;
        } while (page);
        return results;
    }

    private aliasBody(version: number, receiver?: string): any {
        const body: any = { version };
        if (receiver) {
            body.receiver = receiver;
        }
        return body;
    }

    // General

    async getNickname(): Promise<string> {
        return this.request<string>({ method: 'GET', url: '/forgeapps/me' });
    }

    async listEngines(): Promise<string[]> {
        return this.getPaged<string>('/engines');
    }

    // App bundles

    async listAppBundles(): Promise<string[]> {
        return this.getPaged<string>('/appbundles');
    }

    async getAppBundle(id: string): Promise<IAppBundleDetail> {
        return this.request<IAppBundleDetail>({ method: 'GET', url: `/appbundles/${id}` });
    }

    async getAppBundleVersion(name: string, version: number): Promise<IAppBundleDetail> {
        return this.request<IAppBundleDetail>({ method: 'GET', url: `/appbundles/${name}/versions/${version}` });
    }

    async createAppBundle(name: string, engine: string, settings: any, description: string): Promise<IAppBundleUploadParams> {
        return this.request<IAppBundleUploadParams>({ method: 'POST', url: '/appbundles', data: { id: name, engine, settings, description } });
    }

    async updateAppBundle(name: string, engine: string, settings: any, description: string): Promise<IAppBundleUploadParams> {
        return this.request<IAppBundleUploadParams>({ method: 'POST', url: `/appbundles/${name}/versions`, data: { engine, settings, description } });
    }

    async uploadAppBundleArchive(details: IAppBundleUploadParams, stream: fs.ReadStream): Promise<void> {
        const { endpointURL, formData } = details.uploadParameters;
        const form = new FormData();
        for (const [key, value] of Object.entries(formData)) {
            form.append(key, value);
        }
        form.append('file', stream); // The archive must be the last field
        // The endpoint URL is a pre-signed S3 upload, not on the APS host - no baseURL, no bearer token.
        await axios.post(endpointURL, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
    }

    async deleteAppBundle(id: string): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/appbundles/${id}` });
    }

    async listAppBundleVersions(id: string): Promise<number[]> {
        return this.getPaged<number>(`/appbundles/${id}/versions`);
    }

    async deleteAppBundleVersion(id: string, version: number): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/appbundles/${id}/versions/${version}` });
    }

    async listAppBundleAliases(id: string): Promise<IAlias[]> {
        return this.getPaged<IAlias>(`/appbundles/${id}/aliases`);
    }

    async createAppBundleAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.request<IAlias>({ method: 'POST', url: `/appbundles/${id}/aliases`, data: { id: alias, ...this.aliasBody(version, receiver) } });
    }

    async updateAppBundleAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.request<IAlias>({ method: 'PATCH', url: `/appbundles/${id}/aliases/${alias}`, data: this.aliasBody(version, receiver) });
    }

    async deleteAppBundleAlias(id: string, alias: string): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/appbundles/${id}/aliases/${alias}` });
    }

    // Activities

    async listActivities(): Promise<string[]> {
        return this.getPaged<string>('/activities');
    }

    async getActivity(id: string): Promise<IActivityDetail> {
        return this.request<IActivityDetail>({ method: 'GET', url: `/activities/${id}` });
    }

    async getActivityVersion(name: string, version: number): Promise<IActivityDetail> {
        return this.request<IActivityDetail>({ method: 'GET', url: `/activities/${name}/versions/${version}` });
    }

    async createActivity(id: string, engine: string, commands: string[], appBundles: string[], parameters: { [key: string]: IActivityParam }, settings: ActivitySettings, description: string): Promise<IActivityDetail> {
        return this.request<IActivityDetail>({ method: 'POST', url: '/activities', data: { id, commandLine: commands, engine, appbundles: appBundles, parameters, settings, description } });
    }

    async updateActivity(id: string, engine: string, commands: string[], appBundles: string[], parameters: { [key: string]: IActivityParam }, settings: ActivitySettings, description: string): Promise<IActivityDetail> {
        return this.request<IActivityDetail>({ method: 'POST', url: `/activities/${id}/versions`, data: { commandLine: commands, engine, appbundles: appBundles, parameters, settings, description } });
    }

    async deleteActivity(id: string): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/activities/${id}` });
    }

    async listActivityVersions(id: string): Promise<number[]> {
        return this.getPaged<number>(`/activities/${id}/versions`);
    }

    async deleteActivityVersion(id: string, version: number): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/activities/${id}/versions/${version}` });
    }

    async listActivityAliases(id: string): Promise<IAlias[]> {
        return this.getPaged<IAlias>(`/activities/${id}/aliases`);
    }

    async createActivityAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.request<IAlias>({ method: 'POST', url: `/activities/${id}/aliases`, data: { id: alias, ...this.aliasBody(version, receiver) } });
    }

    async updateActivityAlias(id: string, alias: string, version: number, receiver?: string): Promise<IAlias> {
        return this.request<IAlias>({ method: 'PATCH', url: `/activities/${id}/aliases/${alias}`, data: this.aliasBody(version, receiver) });
    }

    async deleteActivityAlias(id: string, alias: string): Promise<void> {
        await this.request<void>({ method: 'DELETE', url: `/activities/${id}/aliases/${alias}` });
    }

    // Work items

    async createWorkItem(activityId: string, parameters: { [key: string]: IWorkItemParam }): Promise<IWorkItemDetail> {
        return this.request<IWorkItemDetail>({ method: 'POST', url: '/workitems', data: { activityId, arguments: parameters } });
    }

    async getWorkItem(id: string): Promise<IWorkItemDetail> {
        return this.request<IWorkItemDetail>({ method: 'GET', url: `/workitems/${id}` });
    }
}

export function createDesignAutomationClient(env: IEnvironment): DesignAutomationClient {
    return new DesignAutomationClient(
        new ClientCredentialsAuthenticationProvider(env.clientId, env.clientSecret, SCOPES, env.host),
        env.host,
        env.designAutomationRegion as DesignAutomationRegion
    );
}
