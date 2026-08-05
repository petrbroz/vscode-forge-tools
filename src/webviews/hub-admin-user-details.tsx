import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { HubAdminUserDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminUserDetailsProps {
    detail: HubAdminUserDetails;
    imageDataUri?: string;
}

const HubAdminUserDetailsView = ({ detail, imageDataUri }: IHubAdminUserDetailsProps) => (
    <div>
        <h1>User Details: {detail.name || detail.email}</h1>
        <div style={{ display: 'flex', gap: '1em', alignItems: 'flex-start' }}>
            {imageDataUri && <img src={imageDataUri} alt={detail.name || detail.email} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />}
            <Grid columns={'1fr 1fr'}>
                <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.email}>E-mail</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.name}>Name</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.company_name || ''}>Company</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.role || ''}>Role</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.status || ''}>Status</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.job_title || ''}>Job Title</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.phone || ''}>Phone</VSCodeTextField>

                <VSCodeTextField readOnly value={[detail.city, detail.state_or_province, detail.country].filter(Boolean).join(', ')}>Location</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.last_sign_in || ''}>Last Sign In</VSCodeTextField>
            </Grid>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminUserDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminUserDetailsView {...props} />);
}
