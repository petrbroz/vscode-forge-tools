import { IContext } from "../common";

export class ModelDerivativeFormats {
    private readonly _outputFormats = new Set<string>();
    private readonly _outputFormatsBySourceFormat = new Map<string, string[]>();

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

    readonly outputFormats: string[] = [];

    static async create(context: IContext) {
        const availableTranslations = await getAvailableTranslations(context);

        return new ModelDerivativeFormats(availableTranslations);
    }

    hasOutput(outputFormat: string): boolean {
        return this._outputFormats.has(outputFormat);
    }

    findAvailableOutputFormats(sourceFormat: string): string[] {
        return this._outputFormatsBySourceFormat.get(sourceFormat) || [];
    }
}

export const svf = "svf" as const;
export const svf2 = "svf2" as const;

export const isViewableFormat = (format: string) => format === svf || format === svf2;

type DerivativeTranslation = {
    outputFormat: string;
    sourceFormats: string[];
}

const getAvailableTranslations = async (context: IContext): Promise<DerivativeTranslation[]> => {
    const availableTranslations: DerivativeTranslation[] = [];

    const formats = await context.modelDerivativeClient2L.formats();

    for (const outputFormat in formats) {
        if (Object.prototype.hasOwnProperty.call(formats, outputFormat)) {
            const sourceFormats = formats[outputFormat];

            availableTranslations.push({ outputFormat, sourceFormats });
        }
    }

    return availableTranslations;
}