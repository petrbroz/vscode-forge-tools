import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Grid } from './components/Grid';
import { ServiceAccountDetails } from '../models/secure-service-accounts';

export interface ISecureServiceAccountDetailsProps {
    detail: ServiceAccountDetails;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountDetailsProps) => (
    <div>
        <h1>Secure Service Account: {detail.serviceAccountId}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.serviceAccountId!}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.email!}>E-mail</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.status!}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdBy!}>Created By</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdAt!}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.accessedAt!}>Accessed At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.expiresAt!}>Expires At</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
