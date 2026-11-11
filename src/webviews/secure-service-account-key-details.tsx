import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { Grid } from './components/Grid';
import { ServiceAccountKeyDetails } from '../models/secure-service-accounts';

export interface ISecureServiceAccountKeyDetailsProps {
    detail: ServiceAccountKeyDetails;
}

const SecureServiceAccountDetails = ({ detail }: ISecureServiceAccountKeyDetailsProps) => (
    <div>
        <h1>Secure Service Account Key: {detail.kid}</h1>
        <Grid>
            <TextField readOnly value={detail.kid!}>ID</TextField>
            <TextField readOnly value={detail.status!}>Status</TextField>
            <TextField readOnly value={detail.createdAt!}>Created At</TextField>
            <TextField readOnly value={detail.accessedAt!}>Accessed At</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: ISecureServiceAccountKeyDetailsProps) {
    ReactDOM.createRoot(container).render(<SecureServiceAccountDetails {...props} />);
}
