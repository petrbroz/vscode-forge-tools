import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField, DataGrid, DataGridRow, DataGridCell } from './components/controls';
import { Bucket } from '../models/oss';
import { Grid } from './components/Grid';

export interface IBucketDetailsProps {
    detail: Bucket;
}

const BucketDetails = ({ detail }: IBucketDetailsProps) => (
    <div>
        <h1>Bucket Details: {detail.bucketKey}</h1>
        <Grid>
            <TextField readOnly value={detail.bucketKey}>Bucket Key</TextField>
            <TextField readOnly value={detail.bucketOwner}>Owner</TextField>
            <TextField readOnly value={new Date(Number(detail.createdDate)).toLocaleDateString()}>Created</TextField>
            <TextField readOnly value={detail.policyKey}>Data Retention Policy</TextField>
        </Grid>

        <h2>Permissions</h2>
        <DataGrid>
            <DataGridRow row-type="header">
                <DataGridCell cell-type="columnheader" grid-column="1">
                    Client ID
                </DataGridCell>
                <DataGridCell cell-type="columnheader" grid-column="2">
                    Access Level
                </DataGridCell>
            </DataGridRow>
            {(detail.permissions ?? []).map(permission => (
                <DataGridRow>
                    <DataGridCell grid-column="1">{permission.authId}</DataGridCell>
                    <DataGridCell grid-column="2">{permission.access}</DataGridCell>
                </DataGridRow>
            ))}
        </DataGrid>
    </div>
);

export function render(container: HTMLElement, props: IBucketDetailsProps) {
    ReactDOM.createRoot(container).render(<BucketDetails {...props} />);
}