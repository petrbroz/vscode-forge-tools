import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell } from '@vscode/webview-ui-toolkit/react';
import { IBucketDetail } from 'forge-server-utils';

export interface IBucketDetailsProps {
    detail: IBucketDetail;
}

const BucketDetails = ({ detail }: IBucketDetailsProps) => (
    <div>
        <h1>Bucket Details: {detail.bucketKey}</h1>
        <div style={{ display: 'grid', gap: '1em' }}>
            <VSCodeTextField readOnly value={detail.bucketKey}>Bucket Key</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.bucketOwner}>Owner</VSCodeTextField>
            <VSCodeTextField readOnly value={new Date(detail.createdDate).toLocaleDateString()}>Created</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.policyKey}>Data Retention Policy</VSCodeTextField>
        </div>

        <h2>Permissions</h2>
        <VSCodeDataGrid>
            <VSCodeDataGridRow row-type="header">
                <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
                    Client ID
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cell-type="columnheader" grid-column="2">
                    Access Level
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            {detail.permissions.map(permission => (
                <VSCodeDataGridRow>
                    <VSCodeDataGridCell grid-column="1">{permission.authId}</VSCodeDataGridCell>
                    <VSCodeDataGridCell grid-column="2">{permission.access}</VSCodeDataGridCell>
                </VSCodeDataGridRow>
            ))}
        </VSCodeDataGrid>
    </div>
);

export function render(container: HTMLElement, props: IBucketDetailsProps) {
    ReactDOM.createRoot(container).render(<BucketDetails {...props} />);
}