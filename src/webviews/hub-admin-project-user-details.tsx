import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { HubAdminProjectUserDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminProjectUserDetailsProps {
    detail: HubAdminProjectUserDetails;
    imageDataUri?: string;
}

const HubAdminProjectUserDetailsView = ({ detail, imageDataUri }: IHubAdminProjectUserDetailsProps) => (
    <div>
        <h1>Project User Details: {detail.name || detail.email}</h1>
        <div style={{ display: 'flex', gap: '1em', alignItems: 'flex-start' }}>
            {imageDataUri && <img src={imageDataUri} alt={detail.name || detail.email} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />}
            <Grid columns={'1fr 1fr'}>
                <TextField readOnly value={detail.id}>ID</TextField>
                <TextField readOnly value={detail.email}>E-mail</TextField>

                <TextField readOnly value={detail.name}>Name</TextField>
                <TextField readOnly value={detail.companyName || ''}>Company</TextField>

                <TextField readOnly value={detail.status || ''}>Status</TextField>
                <TextField readOnly value={detail.jobTitle || ''}>Job Title</TextField>

                <TextField readOnly value={(detail.roles ?? []).map(role => role.name).filter(Boolean).join(', ')}>Roles</TextField>
                <TextField readOnly value={[detail.city, detail.stateOrProvince, detail.country].filter(Boolean).join(', ')}>Location</TextField>

                <TextField readOnly value={detail.addedOn || ''}>Added On</TextField>
                <TextField readOnly value={detail.updatedAt || ''}>Updated At</TextField>
            </Grid>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminProjectUserDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminProjectUserDetailsView {...props} />);
}
