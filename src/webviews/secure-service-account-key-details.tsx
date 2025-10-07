import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Grid } from './components/Grid';
import { KeysGetResponse_keys } from '../clients/secure-service-accounts/serviceAccounts/item/keys';

export interface ISecureServiceAccountKeyDetailsProps {
    detail: KeysGetResponse_keys;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountKeyDetailsProps) => (
    <div>
        <h1>Secure Service Account Key: {detail.kid}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.kid!}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.status!}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdAt!.toString()}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.accessedAt!.toString()}>Accessed At</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountKeyDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
