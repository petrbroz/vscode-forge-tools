import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { VSCodeTextField, VSCodeCheckbox, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { postMessage } from './common';
import { Grid } from './components/Grid';
import { Actions } from './components/Actions';
import { EnumDropdown } from './components/EnumDropdown';
import {
    svf, svf2, svfSourceFormats, SvfSourceFormat,
    JobAdvancedOptions, ICustomTranslationOptions,
    Model2dView, ExtractorVersion, MaterialMode,
    ConversionMethod, BuildingStoreys, Spaces, OpeningElements,
    Hierarchy,
    ExportFileStructure, Unit,
    ApplicationProtocol,
    SurfaceType, SheetType, SolidType,
    Width, Height,
    StlFormat,
} from '../models/model-derivative';

export interface ICustomDerivativeProps {
    urn: string;
    availableFormats: string[];
    sourceFormat: string;
}

export interface ICustomDerivativeMessage {
    type: 'translate',
    data: ICustomTranslationOptions
}

const CustomDerivative = ({ urn, availableFormats, sourceFormat }: ICustomDerivativeProps) => {
    const [outputFormat, setOutputFormatState] = useState(availableFormats.find(x => x === svf2) || availableFormats[0]);
    const [compressedUrn, setCompressedUrn] = useState(sourceFormat === 'zip');
    const [rootFilename, setRootFilename] = useState('');
    const [views2d, setViews2d] = useState(true);
    const [views3d, setViews3d] = useState(true);
    const [advanced, setAdvanced] = useState<JobAdvancedOptions>({});
    const [workflowId, setWorkflowId] = useState('');
    const [workflowAttributes, setWorkflowAttributes] = useState('');

    function setAdvancedField<K extends keyof JobAdvancedOptions>(key: K, value: JobAdvancedOptions[K]) {
        setAdvanced(prev => ({ ...prev, [key]: value }));
    }

    function isSvfFamily(format: string): boolean {
        return format === svf || format === svf2;
    }

    function setOutputFormat(value: string) {
        if (isSvfFamily(outputFormat) !== isSvfFamily(value)) {
            setAdvanced({});
        }
        setOutputFormatState(value);
    }

    function parseNumberList(value: string): number[] {
        return value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n));
    }

    function startTranslation() {
        postMessage<ICustomDerivativeMessage>({
            type: 'translate',
            data: { outputFormat, compressedUrn, rootFilename, views2d, views3d, advanced, workflowId, workflowAttributes }
        });
    }

    function renderSvfSourceFields() {
        if (!(svfSourceFormats as readonly string[]).includes(sourceFormat)) {
            return null;
        }
        switch (sourceFormat as SvfSourceFormat) {
            case 'rvt':
                return (
                    <>
                        <EnumDropdown label="2D Views" value={advanced['2dviews'] || Model2dView.Legacy} options={Object.values(Model2dView)} onChange={v => setAdvancedField('2dviews', v)} />
                        <EnumDropdown label="Extractor Version" value={advanced.extractorVersion || ExtractorVersion.Next} options={Object.values(ExtractorVersion)} onChange={v => setAdvancedField('extractorVersion', v)} />
                        <VSCodeCheckbox checked={!!advanced.generateMasterViews} onChange={ev => setAdvancedField('generateMasterViews', (ev.target as any).checked)}>Generate Master Views</VSCodeCheckbox>
                        <EnumDropdown label="Material Mode" value={advanced.materialMode || MaterialMode.Auto} options={Object.values(MaterialMode)} onChange={v => setAdvancedField('materialMode', v)} />
                    </>
                );
            case 'dgn':
                return (
                    <VSCodeTextField value={(advanced.requestedLinkageIDs || []).join(',')} onChange={ev => setAdvancedField('requestedLinkageIDs', parseNumberList((ev.target as any).value))}>Requested Linkage IDs</VSCodeTextField>
                );
            case 'dwg':
            case 'idw':
                return (
                    <EnumDropdown label="2D Views" value={advanced['2dviews'] || Model2dView.Legacy} options={Object.values(Model2dView)} onChange={v => setAdvancedField('2dviews', v)} />
                );
            case 'ifc':
                return (
                    <>
                        <EnumDropdown label="Conversion Method" value={advanced.conversionMethod || ConversionMethod.V4} options={Object.values(ConversionMethod)} onChange={v => setAdvancedField('conversionMethod', v)} />
                        <EnumDropdown label="Building Storeys" value={advanced.buildingStoreys || BuildingStoreys.Hide} options={Object.values(BuildingStoreys)} onChange={v => setAdvancedField('buildingStoreys', v)} />
                        <EnumDropdown label="Spaces" value={advanced.spaces || Spaces.Hide} options={Object.values(Spaces)} onChange={v => setAdvancedField('spaces', v)} />
                        <EnumDropdown label="Opening Elements" value={advanced.openingElements || OpeningElements.Hide} options={Object.values(OpeningElements)} onChange={v => setAdvancedField('openingElements', v)} />
                    </>
                );
            case 'nwd':
                return (
                    <>
                        <VSCodeCheckbox checked={!!advanced.hiddenObjects} onChange={ev => setAdvancedField('hiddenObjects', (ev.target as any).checked)}>Hidden Objects</VSCodeCheckbox>
                        <VSCodeCheckbox checked={!!advanced.basicMaterialProperties} onChange={ev => setAdvancedField('basicMaterialProperties', (ev.target as any).checked)}>Basic Material Properties</VSCodeCheckbox>
                        <VSCodeCheckbox checked={!!advanced.autodeskMaterialProperties} onChange={ev => setAdvancedField('autodeskMaterialProperties', (ev.target as any).checked)}>Autodesk Material Properties</VSCodeCheckbox>
                        <VSCodeCheckbox checked={!!advanced.timelinerProperties} onChange={ev => setAdvancedField('timelinerProperties', (ev.target as any).checked)}>Timeliner Properties</VSCodeCheckbox>
                    </>
                );
            case 'vue':
                return (
                    <EnumDropdown label="Hierarchy" value={advanced.hierarchy || Hierarchy.Classic} options={Object.values(Hierarchy)} onChange={v => setAdvancedField('hierarchy', v)} />
                );
            default:
                return null;
        }
    }

    /** Settings tied directly to the selected output format alone (no source-format dependency). */
    function renderOutputFormatFields() {
        switch (outputFormat) {
            case svf:
            case svf2:
                return (
                    <>
                        <VSCodeCheckbox checked={views2d} onChange={ev => setViews2d((ev.target as any).checked)}>2D Views</VSCodeCheckbox>
                        <VSCodeCheckbox checked={views3d} onChange={ev => setViews3d((ev.target as any).checked)}>3D Views</VSCodeCheckbox>
                    </>
                );
            case 'thumbnail':
                return (
                    <>
                        <EnumDropdown label="Width" value={advanced.width || Width.NUMBER_200} options={Object.values(Width)} onChange={v => setAdvancedField('width', v)} />
                        <EnumDropdown label="Height" value={advanced.height || Height.NUMBER_200} options={Object.values(Height)} onChange={v => setAdvancedField('height', v)} />
                    </>
                );
            default:
                return null;
        }
    }

    /** Settings that depend on the combination of output format and (for SVF/SVF2) source format. */
    function renderAdvancedFields() {
        switch (outputFormat) {
            case svf:
            case svf2:
                return renderSvfSourceFields();
            case 'stl':
                return (
                    <>
                        <EnumDropdown label="Format" value={advanced.format || StlFormat.Binary} options={Object.values(StlFormat)} onChange={v => setAdvancedField('format', v)} />
                        <VSCodeCheckbox checked={advanced.exportColor !== false} onChange={ev => setAdvancedField('exportColor', (ev.target as any).checked)}>Export Color</VSCodeCheckbox>
                        <EnumDropdown label="Export File Structure" value={advanced.exportFileStructure || ExportFileStructure.Single} options={Object.values(ExportFileStructure)} onChange={v => setAdvancedField('exportFileStructure', v)} />
                    </>
                );
            case 'obj':
                return (
                    <>
                        <EnumDropdown label="Export File Structure" value={advanced.exportFileStructure || ExportFileStructure.Single} options={Object.values(ExportFileStructure)} onChange={v => setAdvancedField('exportFileStructure', v)} />
                        <EnumDropdown label="Unit" value={advanced.unit || Unit.Meter} options={Object.values(Unit)} onChange={v => setAdvancedField('unit', v)} />
                        <VSCodeTextField value={advanced.modelGuid || ''} onChange={ev => setAdvancedField('modelGuid', (ev.target as any).value)}>Model GUID</VSCodeTextField>
                        <VSCodeTextField value={(advanced.objectIds || []).join(',')} onChange={ev => setAdvancedField('objectIds', parseNumberList((ev.target as any).value))}>Object IDs</VSCodeTextField>
                    </>
                );
            case 'step':
                return (
                    <>
                        <EnumDropdown label="Application Protocol" value={advanced.applicationProtocol || ApplicationProtocol._214} options={Object.values(ApplicationProtocol)} onChange={v => setAdvancedField('applicationProtocol', v)} />
                        <VSCodeTextField value={advanced.tolerance?.toString() ?? ''} onChange={ev => setAdvancedField('tolerance', parseFloat((ev.target as any).value))}>Tolerance</VSCodeTextField>
                    </>
                );
            case 'iges':
                return (
                    <>
                        <VSCodeTextField value={advanced.tolerance?.toString() ?? ''} onChange={ev => setAdvancedField('tolerance', parseFloat((ev.target as any).value))}>Tolerance</VSCodeTextField>
                        <EnumDropdown label="Surface Type" value={advanced.surfaceType || SurfaceType.Bounded} options={Object.values(SurfaceType)} onChange={v => setAdvancedField('surfaceType', v)} />
                        <EnumDropdown label="Sheet Type" value={advanced.sheetType || SheetType.Surface} options={Object.values(SheetType)} onChange={v => setAdvancedField('sheetType', v)} />
                        <EnumDropdown label="Solid Type" value={advanced.solidType || SolidType.Solid} options={Object.values(SolidType)} onChange={v => setAdvancedField('solidType', v)} />
                    </>
                );
            case 'dwg':
            case 'ifc':
                return (
                    <VSCodeTextField value={advanced.exportSettingName || ''} onChange={ev => setAdvancedField('exportSettingName', (ev.target as any).value)}>Export Setting Name</VSCodeTextField>
                );
            default:
                return null;
        }
    }

    const outputFormatFields = renderOutputFormatFields();
    const advancedFields = renderAdvancedFields();

    return (
        <div>
            <h1>Custom Translation</h1>

            <h3>Input Settings</h3>
            <Grid columns={'1fr'}>
                <VSCodeTextField readOnly value={urn}>URN</VSCodeTextField>
                <VSCodeCheckbox checked={compressedUrn} onChange={ev => setCompressedUrn((ev.target as any).checked)}>Compressed (ZIP) Source</VSCodeCheckbox>
                <VSCodeTextField disabled={!compressedUrn} value={rootFilename} onChange={ev => setRootFilename((ev.target as any).value)}>Root Filename</VSCodeTextField>
            </Grid>

            <h3>Output Settings</h3>
            <Grid columns={'1fr 1fr'}>
                <EnumDropdown label="Output Format" value={outputFormat} options={availableFormats} style={{ gridColumn: 'span 2' }} onChange={setOutputFormat} formatOption={x => x.toUpperCase()} />
                {outputFormatFields}
            </Grid>

            {advancedFields && (
                <>
                    <h4>Advanced Settings</h4>
                    <Grid columns={'1fr 1fr'}>
                        {advancedFields}
                    </Grid>
                </>
            )}

            <h3>Webhook Settings</h3>
            <Grid columns={'1fr 1fr'}>
                <VSCodeTextField value={workflowId} onChange={ev => setWorkflowId((ev.target as any).value)}>Workflow ID</VSCodeTextField>
                <VSCodeTextField value={workflowAttributes} onChange={ev => setWorkflowAttributes((ev.target as any).value)}>Workflow Attributes</VSCodeTextField>
            </Grid>

            <Actions>
                <VSCodeButton onClick={startTranslation}>Start</VSCodeButton>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: ICustomDerivativeProps) {
    ReactDOM.createRoot(container).render(<CustomDerivative {...props} />);
}
