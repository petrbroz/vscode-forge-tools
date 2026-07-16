// Re-export the Model Derivative SDK types that the vscode layers (commands/providers/webviews)
// need, so those layers depend on `src/models` instead of importing `@aps_sdk/model-derivative`
// directly. Runtime SDK enums/values stay inside `src/services/model-derivative.ts`.
export type { Manifest, ObjectTree, Properties, JobPayload } from '@aps_sdk/model-derivative';

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
