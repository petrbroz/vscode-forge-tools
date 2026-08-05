import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
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
                <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.email}>E-mail</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.name}>Name</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.companyName || ''}>Company</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.status || ''}>Status</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.jobTitle || ''}>Job Title</VSCodeTextField>

                <VSCodeTextField readOnly value={(detail.roles ?? []).map(role => role.name).filter(Boolean).join(', ')}>Roles</VSCodeTextField>
                <VSCodeTextField readOnly value={[detail.city, detail.stateOrProvince, detail.country].filter(Boolean).join(', ')}>Location</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.addedOn || ''}>Added On</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.updatedAt || ''}>Updated At</VSCodeTextField>
            </Grid>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminProjectUserDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminProjectUserDetailsView {...props} />);
}
