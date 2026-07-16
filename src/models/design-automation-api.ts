/**
 * Dependency-free data types and helpers for the APS Design Automation v3 API. There is no official
 * `@aps_sdk/*` SDK for Design Automation, so these replace the types the extension used to import
 * from the legacy SDK. This module MUST stay free of runtime dependencies (no `axios`, no Node APIs)
 * so it can be safely imported by the React webviews - the REST client itself lives in
 * `src/clients/design-automation.ts`.
 */

/** A parameter of an activity (`IActivityDetail.parameters` value). */
export interface IActivityParam {
    name: string;
    verb?: string;
    description?: string;
    localName?: string;
    required?: boolean;
    zip?: boolean;
    ondemand?: boolean;
}

/** A string/environment-variable setting of an activity (`IActivityDetail.settings` value). */
export interface ICodeOnEngineStringSetting {
    name: string;
    value: string;
    isEnvironmentVariable: boolean;
}

/** A URL setting of an activity (`IActivityDetail.settings` value). */
export interface ICodeOnEngineUrlSetting {
    name: string;
    url: string;
    verb: string;
    headers?: { [key: string]: string };
}

/** A single work item argument. */
export interface IWorkItemParam {
    url: string;
    localName?: string;
    optional?: boolean;
    pathInZip?: string;
    headers?: { [key: string]: string };
    verb?: string;
}

export interface IActivityDetail {
    id: string;
    version: number;
    engine: string;
    description?: string;
    commandLine: string[];
    parameters?: { [key: string]: IActivityParam };
    settings?: { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting };
    appbundles?: string[];
}

export interface IAppBundleDetail {
    id: string;
    version: number;
    engine: string;
    description?: string;
    package?: string;
}

/** Details of a newly created app bundle (version), including the signed archive-upload parameters. */
export interface IAppBundleUploadParams extends IAppBundleDetail {
    uploadParameters: {
        endpointURL: string;
        formData: { [key: string]: string };
    };
}

export interface IAlias {
    id: string;
    version: number;
    receiver?: string;
}

export interface IWorkItemDetail {
    id: string;
    status: string;
    reportUrl: string;
    progress?: string;
    stats?: any;
}

/**
 * A fully-qualified Design Automation identifier of the form `owner.id+alias`.
 */
export class DesignAutomationID {
    constructor(public owner: string, public id: string, public alias: string) {}

    /**
     * Parses a fully-qualified ID string (`owner.id+alias`). Returns `null` (rather than throwing)
     * when the input does not match, so callers can filter unparseable IDs out of a list.
     */
    static parse(str: string): DesignAutomationID | null {
        const match = str.match(/^([^.]+)\.([^+]+)\+(.+)$/);
        return match ? new DesignAutomationID(match[1], match[2], match[3]) : null;
    }

    toString(): string {
        return `${this.owner}.${this.id}+${this.alias}`;
    }
}
