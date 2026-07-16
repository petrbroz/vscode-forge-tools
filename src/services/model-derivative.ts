import * as fs from 'fs';
import * as path from 'path';
import {
    ModelDerivativeClient,
    JobPayload,
    Manifest,
    ObjectTree,
    Properties,
    ModelViews
} from '@aps_sdk/model-derivative';
import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import { urnify } from '../urn';
import { ObjectDetails } from '../models/oss';
import { IVersion } from '../models/hubs';
import { IDerivative, DerivativeTranslation, svf, svf2 } from '../models/model-derivative';

/**
 * Returns `true` for URNs that belong to a Hubs (Data Management) resource rather than an OSS object.
 * Hubs URNs are URL-safe base64 (the source id's `/` characters replaced with `_`); plain OSS URNs
 * never contain `_`, so the presence of one distinguishes the two.
 */
function inHubs(urn: string): boolean {
    return urn.indexOf('_') !== -1;
}

/** `true` for output formats that can be opened in the Autodesk viewer. */
function isViewableFormat(format: string): boolean {
    return format === svf || format === svf2;
}

/** URL-safe base64 URN (the plain base64 URN with its single `/` replaced by `_`). */
function urlSafeUrn(id: string): string {
    return urnify(id).replace('/', '_');
}

function getId(object: ObjectDetails | IVersion): string {
    if ('objectId' in object) { // ObjectDetails
        return object.objectId!;
    } else if ('itemId' in object) { // IVersion
        return object.id;
    }
    return '';
}

function getFileExtension(object: ObjectDetails | IVersion): string {
    if ('objectKey' in object) {
        return path.extname(object.objectKey!).substring(1).toLowerCase();
    }
    return '';
}

/**
 * Index of the Model Derivative service's supported translations, letting callers ask which output
 * formats are available (in general, or for a given source format).
 */
class ModelDerivativeFormats {
    private readonly _outputFormats = new Set<string>();
    private readonly _outputFormatsBySourceFormat = new Map<string, string[]>();

    readonly outputFormats: string[] = [];

    constructor(availableTranslations: DerivativeTranslation[]) {
        for (const derivativeTranslation of availableTranslations) {
            this._outputFormats.add(derivativeTranslation.outputFormat);
            this.outputFormats.push(derivativeTranslation.outputFormat);

            for (const sourceFormat of derivativeTranslation.sourceFormats) {
                const outputFormats = this._outputFormatsBySourceFormat.get(sourceFormat) || [];
                outputFormats.push(derivativeTranslation.outputFormat);
                this._outputFormatsBySourceFormat.set(sourceFormat, outputFormats);
            }
        }
    }

    hasOutput(outputFormat: string): boolean {
        return this._outputFormats.has(outputFormat);
    }

    findAvailableOutputFormats(sourceFormat: string): string[] {
        return this._outputFormatsBySourceFormat.get(sourceFormat) || [];
    }
}

/**
 * Domain logic for the Model Derivative service. Wraps an app-context (2-legged) and a user-context
 * `ModelDerivativeClient` and exposes plain, domain-shaped operations so the vscode layers never touch
 * the SDK's clients, enums, or manifest transforms. Client selection is purely by resource: OSS objects
 * are app-owned so they use the app client, while Hubs versions require user context so they use the
 * user client (the user client's provider is the active session, or a 2-legged fallback - Hubs views are
 * gated behind sign-in, so the fallback is never actually exercised). Owns all
 * `@aps_sdk/model-derivative` access and the supported-formats cache.
 */
export class ModelDerivativeService {
    private _formats: Promise<ModelDerivativeFormats> | null = null;

    constructor(
        private readonly appClient: ModelDerivativeClient,
        private readonly userClient: ModelDerivativeClient,
        private readonly appViewerProvider: IAuthenticationProvider,
        private readonly userProvider: IAuthenticationProvider
    ) {}

    /** Picks the client for a URN: user context for Hubs resources, app context for OSS objects. */
    private clientForUrn(urn: string): ModelDerivativeClient {
        return inHubs(urn) ? this.userClient : this.appClient;
    }

    /** Picks the client for a tree object: OSS objects use the app client, Hubs versions the user client. */
    private clientForObject(object: ObjectDetails | IVersion): ModelDerivativeClient {
        if ('itemId' in object) { // IVersion (Hubs)
            return this.userClient;
        }
        return this.appClient; // ObjectDetails (OSS) and any fallback
    }

    private async getFormats(): Promise<ModelDerivativeFormats> {
        if (this._formats === null) {
            this._formats = (async () => {
                const availableTranslations: DerivativeTranslation[] = [];
                const { formats = {} } = await this.appClient.getFormats();
                for (const outputFormat in formats) {
                    if (Object.prototype.hasOwnProperty.call(formats, outputFormat)) {
                        availableTranslations.push({ outputFormat, sourceFormats: formats[outputFormat] });
                    }
                }
                return new ModelDerivativeFormats(availableTranslations);
            })().catch(err => {
                // Don't cache a failed fetch - let the next call retry instead of poisoning the cache forever.
                this._formats = null;
                throw err;
            });
        }
        return this._formats;
    }

    /** Returns the URL-safe base64 URN of a tree object (OSS object or Hubs version). */
    getObjectUrn(object: ObjectDetails | IVersion): string {
        return urlSafeUrn(getId(object));
    }

    /** Output formats the service can produce from the given tree object's source format. */
    async getSupportedOutputFormats(object: ObjectDetails | IVersion): Promise<string[]> {
        const formats = await this.getFormats();
        return formats.findAvailableOutputFormats(getFileExtension(object));
    }

    /** Starts a default SVF2 (2d + 3d) translation job for the given tree object, forcing re-translation. */
    translateToSvf2(object: ObjectDetails | IVersion): Promise<unknown> {
        const urn = this.getObjectUrn(object);
        return this.clientForObject(object).startJob(
            { input: { urn }, output: { formats: [{ type: svf2, views: ['2d', '3d'] }] as any } },
            { xAdsForce: true }
        );
    }

    /** Starts a custom translation job (payload built by the caller) for the given tree object. */
    async startCustomTranslation(object: ObjectDetails | IVersion, jobPayload: JobPayload): Promise<void> {
        await this.clientForObject(object).startJob(jobPayload, { xAdsForce: true });
    }

    /** Lists the Model Views (viewables) of a tree object. */
    getModelViews(object: ObjectDetails | IVersion): Promise<ModelViews> {
        return this.clientForObject(object).getModelViews(this.getObjectUrn(object));
    }

    /** Fetches the manifest of a tree object (used to check translation status). */
    getObjectManifest(object: ObjectDetails | IVersion): Promise<Manifest> {
        return this.clientForObject(object).getManifest(this.getObjectUrn(object));
    }

    /** Downloads the 100x100, 200x200 and 400x400 thumbnails of a tree object, as binary strings. */
    getObjectThumbnails(object: ObjectDetails | IVersion): Promise<[string, string, string]> {
        const client = this.clientForObject(object);
        const urn = this.getObjectUrn(object);
        return Promise.all([
            client.getThumbnail(urn, { width: 100, height: 100 }),
            client.getThumbnail(urn, { width: 200, height: 200 }),
            client.getThumbnail(urn, { width: 400, height: 400 })
        ]);
    }

    /** Fetches the manifest of an already-encoded URN (OSS objects use the app client). */
    getManifest(urn: string): Promise<Manifest> {
        return this.appClient.getManifest(urn);
    }

    /** Fetches the manifest of a Hubs version (uses the user client when logged in). */
    getVersionManifest(versionId: string): Promise<Manifest> {
        const urn = urlSafeUrn(versionId);
        return this.clientForUrn(urn).getManifest(urn);
    }

    /** Deletes the manifest (and all derivatives) of a tree object. */
    async deleteManifest(object: ObjectDetails | IVersion): Promise<void> {
        const urn = this.getObjectUrn(object);
        await this.clientForUrn(urn).deleteManifest(urn);
    }

    /** Fetches a viewable's object tree; pass `forceGet` to bypass the 20 MB response limit. */
    getObjectTree(urn: string, guid: string, forceGet: boolean = false): Promise<ObjectTree> {
        return this.clientForUrn(urn).getObjectTree(urn, guid, forceGet ? { forceget: 'true' } : undefined);
    }

    /** Fetches all properties of a viewable; pass `forceGet` to bypass the 20 MB response limit. */
    getAllProperties(urn: string, guid: string, forceGet: boolean = false): Promise<Properties> {
        return this.clientForUrn(urn).getAllProperties(urn, guid, forceGet ? { forceget: 'true' } : undefined);
    }

    /** Maps a viewable derivative's geometry children into `IDerivative` view models. */
    private static mapGeometryDerivatives(derivative: any, urn: string): IDerivative[] {
        return derivative.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => ({
            urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            format: derivative.outputType,
            bubble: geometry
        }));
    }

    /** Transforms a successful manifest into the tree's derivatives (viewable geometries or downloadable resources). */
    async getManifestDerivatives(manifest: Manifest, urn: string): Promise<IDerivative[]> {
        const formats = await this.getFormats();
        const derivative = (manifest as any).derivatives.find((deriv: any) => formats.hasOutput(deriv.outputType));
        if (isViewableFormat(derivative.outputType)) {
            return ModelDerivativeService.mapGeometryDerivatives(derivative, urn);
        } else {
            return derivative.children.filter((child: any) => child.role === derivative.outputType).map((resource: any) => {
                const fileUrn: string = resource.urn;
                return {
                    urn,
                    name: path.basename(fileUrn),
                    role: resource.role,
                    guid: resource.guid,
                    format: derivative.outputType,
                    bubble: { fileUrn },
                    nonViewable: true
                };
            });
        }
    }

    /**
     * Viewable (geometry) derivatives of a Hubs version. Throws if the version isn't fully translated.
     * Pass an already-fetched `manifest` (e.g. from {@link getVersionManifest}) to avoid re-fetching it.
     */
    async getVersionDerivatives(versionId: string, manifest?: Manifest): Promise<IDerivative[]> {
        const urn = urlSafeUrn(versionId);
        const m = (manifest ?? await this.clientForUrn(urn).getManifest(urn)) as any;
        if (m.status !== 'success') {
            throw new Error('Unexpected manifest status: ' + m.status);
        }
        const derivative = m.derivatives.find((deriv: any) => isViewableFormat(deriv.outputType));
        if (!derivative || !derivative.children) {
            return [];
        }
        return ModelDerivativeService.mapGeometryDerivatives(derivative, urn);
    }

    /**
     * Viewable derivatives of an OSS object, for picking one to preview/inspect. Returns `null` when
     * the object has no viewable derivative at all (as opposed to `[]` when it has one but no geometries).
     */
    async getViewableDerivatives(objectId: string): Promise<IDerivative[] | null> {
        const urn = urnify(objectId);
        const manifest = await this.appClient.getManifest(urn) as any;
        const svf = manifest.derivatives.find((deriv: any) => isViewableFormat(deriv.outputType));
        if (!svf) {
            return null;
        }
        return svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => ({
            urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            bubble: geometry
        }));
    }

    /** Non-viewable (downloadable) derivatives of an OSS object, for picking one to download. */
    async getCustomDerivatives(objectId: string): Promise<IDerivative[]> {
        const urn = urnify(objectId);
        const formats = await this.getFormats();
        const manifest = await this.appClient.getManifest(urn) as any;
        return manifest.derivatives
            .filter((deriv: any) => formats.hasOutput(deriv.outputType))
            .filter((deriv: any) => !isViewableFormat(deriv.outputType))
            .flatMap((deriv: any) => deriv.children.filter((child: any) => child.role === deriv.outputType))
            .map((resource: any) => {
                const fileUrn: string = resource.urn;
                return {
                    urn,
                    name: path.basename(fileUrn),
                    role: resource.role,
                    guid: resource.guid,
                    format: resource.role,
                    bubble: { fileUrn }
                };
            });
    }

    /** Writes data to a local file path (e.g. a user-chosen save-dialog target), creating parent directories as needed. */
    async saveToFile(filePath: string, data: string | Uint8Array): Promise<void> {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, data);
    }

    /** Downloads the bytes of a (non-viewable) derivative via its signed download URL. */
    async downloadDerivative(fileUrn: string, modelUrn: string): Promise<Uint8Array> {
        const derivativeDownload = await this.appClient.getDerivativeUrl(encodeURI(fileUrn), modelUrn);
        const response = await fetch(derivativeDownload.url!);
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    /**
     * Returns an access token for loading a derivative in the viewer: the active user-context token for
     * Hubs resources, otherwise a 2-legged token with `viewables:read` scope for OSS objects.
     */
    async getViewerAccessToken(urn: string): Promise<string> {
        return inHubs(urn) ? this.userProvider.getAccessToken() : this.appViewerProvider.getAccessToken();
    }
}
