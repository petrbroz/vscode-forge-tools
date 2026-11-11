import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
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
                <TextField readOnly value={detail.id}>ID</TextField>
                <TextField readOnly value={detail.email}>E-mail</TextField>

                <TextField readOnly value={detail.name}>Name</TextField>
                <TextField readOnly value={detail.company_name || ''}>Company</TextField>

                <TextField readOnly value={detail.role || ''}>Role</TextField>
                <TextField readOnly value={detail.status || ''}>Status</TextField>

                <TextField readOnly value={detail.job_title || ''}>Job Title</TextField>
                <TextField readOnly value={detail.phone || ''}>Phone</TextField>

                <TextField readOnly value={[detail.city, detail.state_or_province, detail.country].filter(Boolean).join(', ')}>Location</TextField>
                <TextField readOnly value={detail.last_sign_in || ''}>Last Sign In</TextField>
            </Grid>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminUserDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminUserDetailsView {...props} />);
}
