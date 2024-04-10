import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { IActivityDetail, IActivityParam } from 'aps-sdk-node';
import { Grid } from './components/Grid';

export interface IActivityDetailsProps {
    detail: IActivityDetail
}

const ActivityCommands = (props: { commands: string[] }) => (
    <VSCodeDataGrid>
        {props.commands.map(command => (
            <VSCodeDataGridRow>
                <VSCodeDataGridCell grid-column="1">{command}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
        ))}
    </VSCodeDataGrid>
);

const ActivityParameters = (props: { params: { [key: string]: IActivityParam } }) => (
    <VSCodeDataGrid>
        <VSCodeDataGridRow row-type="header">
            <VSCodeDataGridCell cell-type="columnheader" grid-column="1">ID</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Description</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Verb</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="4">Local Name</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="5">Required</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="6">Zip</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="7">On Demand</VSCodeDataGridCell>
        </VSCodeDataGridRow>
        {Object.entries(props.params).map(([id, param]) => (
            <VSCodeDataGridRow>
                <VSCodeDataGridCell grid-column="1">{id}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="2">{param.description}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="3">{param.verb}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="4">{param.localName}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="5">
                    <VSCodeCheckbox checked={param.required} readOnly />
                </VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="6">
                    <VSCodeCheckbox checked={param.zip} readOnly />
                </VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="7">
                    <VSCodeCheckbox checked={param.ondemand} readOnly />
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        ))}
    </VSCodeDataGrid>
);

const ActivityValueSettings = (props: { settings: any[] }) => (
    props.settings.length > 0 && <VSCodeDataGrid>
        <VSCodeDataGridRow row-type="header">
            <VSCodeDataGridCell cell-type="columnheader" grid-column="1">ID</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Value</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Env. Var.</VSCodeDataGridCell>
        </VSCodeDataGridRow>
        {props.settings.map(([id, setting]) => (
            <VSCodeDataGridRow>
                <VSCodeDataGridCell grid-column="1">{id}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="2">{(setting as any).value}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="3">{(setting as any).isEnvironmentVariable}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
        ))}
    </VSCodeDataGrid>
);

const ActivityUrlSettings = (props: { settings: any[] }) => (
    props.settings.length > 0 && <VSCodeDataGrid>
        <VSCodeDataGridRow row-type="header">
            <VSCodeDataGridCell cell-type="columnheader" grid-column="1">ID</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="2">URL</VSCodeDataGridCell>
            <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Verb</VSCodeDataGridCell>
        </VSCodeDataGridRow>
        {props.settings.map(([id, setting]) => (
            <VSCodeDataGridRow>
                <VSCodeDataGridCell grid-column="1">{id}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="2">{(setting as any).url}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="3">{(setting as any).verb}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
        ))}
    </VSCodeDataGrid>
);

const ActivityBundles = (props: { bundles: string[] }) => (
    <VSCodeDataGrid>
        {props.bundles.map(bundle => (
            <VSCodeDataGridRow>
                <VSCodeDataGridCell grid-column="1">{bundle}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
        ))}
    </VSCodeDataGrid>
);

const ActivityDetails = ({ detail }: IActivityDetailsProps) => (
    <div>
        <h1>Activity Details: {detail.id}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.description}>Description</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.engine}>Engine</VSCodeTextField>
        </Grid>

        <h2>Commands</h2>
        <ActivityCommands commands={detail.commandLine} />

        {detail.parameters && <>
            <h2>Parameters</h2>
            <ActivityParameters params={detail.parameters} />
        </>}

        {detail.settings && (Object.keys(detail.settings).length > 0) && <>
            <h2>Settings</h2>
            <ActivityValueSettings settings={Object.entries(detail.settings).filter(([id, setting]) => 'value' in (setting as any))} />
            <ActivityUrlSettings settings={Object.entries(detail.settings).filter(([id, setting]) => 'url' in (setting as any))} />
        </>}

        {detail.appbundles && <>
            <h2>App Bundles</h2>
            <ActivityBundles bundles={detail.appbundles} />
        </>}
    </div>
);

export function render(container: HTMLElement, props: IActivityDetailsProps) {
    ReactDOM.createRoot(container).render(<ActivityDetails {...props} />);
}