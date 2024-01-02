import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeCheckbox, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { postMessage } from './common';
import { Grid } from './components/Grid';
import { Actions } from './components/Actions';
import { svf2 } from '../providers/model-derivative';

export interface ICustomDerivativeProps {
    urn: string;
    availableFormats: string[];
}

export interface ICustomDerivativeMessage {
    type: 'translate',
    data: {
        outputFormat: string;
        rootFilename: string;
        workflowId: string;
        workflowAttributes: string;
        switchLoader: boolean;
        generateMasterViews: boolean;
    }
}

const CustomDerivative = ({ urn, availableFormats }: ICustomDerivativeProps) => {
    const [outputFormat, setOutputFormat] = useState(availableFormats.find(x => x === svf2) || availableFormats[0]);
    const [rootFilename, setRootFilename] = useState('');
    const [switchLoader, setSwitchLoader] = useState(false);
    const [generateMasterViews, setGenerateMasterViews] = useState(false);
    const [workflowId, setWorkflowId] = useState('');
    const [workflowAttributes, setWorkflowAttributes] = useState('');

    function startTranslation() {
        postMessage<ICustomDerivativeMessage>({
            type: 'translate',
            data: {
                outputFormat,
                rootFilename,
                switchLoader,
                generateMasterViews,
                workflowId,
                workflowAttributes,
            }
        });
    }

    const outputFormats = availableFormats.map(x => <VSCodeOption value={x} key={x}>Output format: {x.toUpperCase()}</VSCodeOption>)

    return (
        <div>
            <h1>Custom Translation</h1>
            <Grid columns={'1fr 1fr'}>
                <VSCodeTextField readOnly value={urn} style={{ gridColumn: 'span 2' }}>URN</VSCodeTextField>

                {/* TODO: add label to the dropdown */}
                <VSCodeDropdown value={outputFormat} onChange={ev => setOutputFormat((ev.target as any).value)}>
                    {outputFormats}
                </VSCodeDropdown>
                <VSCodeTextField value={rootFilename} onChange={ev => setRootFilename((ev.target as any).value)}>Root Filename</VSCodeTextField>

                <VSCodeCheckbox checked={switchLoader} onChange={ev => setSwitchLoader((ev.target as any).checked)}>Switch Loader</VSCodeCheckbox>
                <VSCodeCheckbox checked={generateMasterViews} onChange={ev => setGenerateMasterViews((ev.target as any).checked)}>Generate Master Views</VSCodeCheckbox>

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