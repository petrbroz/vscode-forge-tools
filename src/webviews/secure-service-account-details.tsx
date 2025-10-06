import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Grid } from './components/Grid';
import { ServiceAccountsGetResponse_serviceAccounts } from '../clients/secure-service-accounts/serviceAccounts';

export interface ISecureServiceAccountDetailsProps {
    detail: ServiceAccountsGetResponse_serviceAccounts;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountDetailsProps) => (
    <div>
        <h1>Secure Service Account: {detail.serviceAccountId}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.email!}>E-mail</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.status!}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdBy!}>Created By</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdAt!.toString()}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.accessedAt!.toString()}>Accessed At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.expiresAt!.toString()}>Expires At</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
