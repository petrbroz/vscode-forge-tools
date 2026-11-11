import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { Grid } from './components/Grid';
import { ServiceAccountDetails } from '../models/secure-service-accounts';

export interface ISecureServiceAccountDetailsProps {
    detail: ServiceAccountDetails;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountDetailsProps) => (
    <div>
        <h1>Secure Service Account: {detail.serviceAccountId}</h1>
        <Grid>
            <TextField readOnly value={detail.serviceAccountId!}>ID</TextField>
            <TextField readOnly value={detail.email!}>E-mail</TextField>
            <TextField readOnly value={detail.status!}>Status</TextField>
            <TextField readOnly value={detail.createdBy!}>Created By</TextField>
            <TextField readOnly value={detail.createdAt!}>Created At</TextField>
            <TextField readOnly value={detail.accessedAt!}>Accessed At</TextField>
            <TextField readOnly value={detail.expiresAt!}>Expires At</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
