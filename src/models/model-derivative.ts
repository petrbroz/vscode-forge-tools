// Re-export the Model Derivative SDK types (and, for small string/number-literal option sets, their
// runtime const objects) that the vscode layers (commands/providers/webviews) need, so those layers
// depend on `src/models` instead of importing `@aps_sdk/model-derivative` directly. No layer outside
// `src/services` imports `@aps_sdk/*` directly - re-exporting the SDK's own enum-like consts here
// (instead of hand-copying their values) still satisfies that rule, and avoids drift from the SDK.
export type { Manifest, ObjectTree, Properties, JobPayload, JobPayloadFormat } from '@aps_sdk/model-derivative';
export {
    Model2dView, ExtractorVersion, MaterialMode,
    ConversionMethod, BuildingStoreys, Spaces, OpeningElements,
    Hierarchy,
    ExportFileStructure, Unit,
    ApplicationProtocol,
    SurfaceType, SheetType, SolidType,
    Width, Height,
    Format as StlFormat,
} from '@aps_sdk/model-derivative';

import type {
    JobPayloadFormatSVFAdvancedRVT, JobPayloadFormatSVFAdvancedDGN, JobPayloadFormatSVFAdvancedDWG,
    JobPayloadFormatSVFAdvancedIFC, JobPayloadFormatSVFAdvancedNWD, JobPayloadFormatSVFAdvancedVUE,
    JobPayloadFormatAdvancedSTLAdvanced, JobPayloadFormatAdvancedOBJAdvanced,
    JobPayloadFormatAdvancedSTEP, JobPayloadFormatAdvancedIGES,
    JobPayloadFormatAdvancedDWG, JobPayloadFormatAdvancedIFC, JobPayloadFormatAdvancedThumbnail,
} from '@aps_sdk/model-derivative';

export interface IDerivative {
    urn: string;
    name: string;
    role: string;
    guid: string;
    format: string;
    bubble: any;
    nonViewable?: boolean;
}

/** The two viewable output formats produced by the Model Derivative service. */
export const svf = 'svf' as const;
export const svf2 = 'svf2' as const;

/** A single "source format(s) -> output format" translation supported by the service. */
export type DerivativeTranslation = {
    outputFormat: string;
    sourceFormats: string[];
};

/**
 * Source formats for which SVF/SVF2 translation jobs accept extra source-specific `advanced` options.
 * Any other source format has no SVF/SVF2 advanced options to offer.
 */
export const svfSourceFormats = ['rvt', 'dgn', 'dwg', 'idw', 'ifc', 'nwd', 'vue'] as const;
export type SvfSourceFormat = typeof svfSourceFormats[number];

/**
 * Flat bag of every documented per-output-format / per-source-format "advanced" field from the Create
 * Translation Job API. Only one format's/source's subset is ever populated at a time by the custom
 * translation webview; unrelated fields are simply omitted when the final job payload is assembled.
 */
export type JobAdvancedOptions = Partial<
    JobPayloadFormatSVFAdvancedRVT & JobPayloadFormatSVFAdvancedDGN & JobPayloadFormatSVFAdvancedDWG &
    JobPayloadFormatSVFAdvancedIFC & JobPayloadFormatSVFAdvancedNWD & JobPayloadFormatSVFAdvancedVUE &
    JobPayloadFormatAdvancedSTLAdvanced & JobPayloadFormatAdvancedOBJAdvanced &
    JobPayloadFormatAdvancedSTEP & JobPayloadFormatAdvancedIGES &
    JobPayloadFormatAdvancedDWG & JobPayloadFormatAdvancedIFC & JobPayloadFormatAdvancedThumbnail
>;

/** Options collected by the custom translation webview and sent to `ModelDerivativeService.startCustomTranslation`. */
export interface ICustomTranslationOptions {
    outputFormat: string;
    compressedUrn: boolean;
    rootFilename: string;
    views2d: boolean;
    views3d: boolean;
    advanced: JobAdvancedOptions;
    workflowId: string;
    workflowAttributes: string;
}
