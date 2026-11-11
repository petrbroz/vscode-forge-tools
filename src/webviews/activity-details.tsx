import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField, DataGrid, DataGridRow, DataGridCell, Checkbox } from './components/controls';
import { IActivityDetail, IActivityParam } from '../models/design-automation-api';
import { Grid } from './components/Grid';

export interface IActivityDetailsProps {
    detail: IActivityDetail
}

const ActivityCommands = (props: { commands: string[] }) => (
    <DataGrid>
        {props.commands.map(command => (
            <DataGridRow>
                <DataGridCell grid-column="1">{command}</DataGridCell>
            </DataGridRow>
        ))}
    </DataGrid>
);

const ActivityParameters = (props: { params: { [key: string]: IActivityParam } }) => (
    <DataGrid>
        <DataGridRow row-type="header">
            <DataGridCell cell-type="columnheader" grid-column="1">ID</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="2">Description</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="3">Verb</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="4">Local Name</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="5">Required</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="6">Zip</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="7">On Demand</DataGridCell>
        </DataGridRow>
        {Object.entries(props.params).map(([id, param]) => (
            <DataGridRow>
                <DataGridCell grid-column="1">{id}</DataGridCell>
                <DataGridCell grid-column="2">{param.description}</DataGridCell>
                <DataGridCell grid-column="3">{param.verb}</DataGridCell>
                <DataGridCell grid-column="4">{param.localName}</DataGridCell>
                <DataGridCell grid-column="5">
                    <Checkbox checked={param.required} readOnly />
                </DataGridCell>
                <DataGridCell grid-column="6">
                    <Checkbox checked={param.zip} readOnly />
                </DataGridCell>
                <DataGridCell grid-column="7">
                    <Checkbox checked={param.ondemand} readOnly />
                </DataGridCell>
            </DataGridRow>
        ))}
    </DataGrid>
);

const ActivityValueSettings = (props: { settings: any[] }) => (
    props.settings.length > 0 && <DataGrid>
        <DataGridRow row-type="header">
            <DataGridCell cell-type="columnheader" grid-column="1">ID</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="2">Value</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="3">Env. Var.</DataGridCell>
        </DataGridRow>
        {props.settings.map(([id, setting]) => (
            <DataGridRow>
                <DataGridCell grid-column="1">{id}</DataGridCell>
                <DataGridCell grid-column="2">{(setting as any).value}</DataGridCell>
                <DataGridCell grid-column="3">{(setting as any).isEnvironmentVariable}</DataGridCell>
            </DataGridRow>
        ))}
    </DataGrid>
);

const ActivityUrlSettings = (props: { settings: any[] }) => (
    props.settings.length > 0 && <DataGrid>
        <DataGridRow row-type="header">
            <DataGridCell cell-type="columnheader" grid-column="1">ID</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="2">URL</DataGridCell>
            <DataGridCell cell-type="columnheader" grid-column="3">Verb</DataGridCell>
        </DataGridRow>
        {props.settings.map(([id, setting]) => (
            <DataGridRow>
                <DataGridCell grid-column="1">{id}</DataGridCell>
                <DataGridCell grid-column="2">{(setting as any).url}</DataGridCell>
                <DataGridCell grid-column="3">{(setting as any).verb}</DataGridCell>
            </DataGridRow>
        ))}
    </DataGrid>
);

const ActivityBundles = (props: { bundles: string[] }) => (
    <DataGrid>
        {props.bundles.map(bundle => (
            <DataGridRow>
                <DataGridCell grid-column="1">{bundle}</DataGridCell>
            </DataGridRow>
        ))}
    </DataGrid>
);

const ActivityDetails = ({ detail }: IActivityDetailsProps) => (
    <div>
        <h1>Activity Details: {detail.id}</h1>
        <Grid>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.description}>Description</TextField>
            <TextField readOnly value={detail.engine}>Engine</TextField>
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