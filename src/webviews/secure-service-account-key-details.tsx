import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Grid } from './components/Grid';
import { ServiceAccountKeyDetails } from '@aps_sdk/secure-service-account';

export interface ISecureServiceAccountKeyDetailsProps {
    detail: ServiceAccountKeyDetails;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountKeyDetailsProps) => (
    <div>
        <h1>Secure Service Account Key: {detail.kid}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.kid!}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.status!}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdAt!}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.accessedAt!}>Accessed At</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountKeyDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
