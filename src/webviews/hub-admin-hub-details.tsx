import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { IHubDetails } from '../models/hubs';
import { Grid } from './components/Grid';

export interface IHubAdminHubDetailsProps {
    detail: IHubDetails;
}

const HubAdminHubDetails = ({ detail }: IHubAdminHubDetailsProps) => (
    <div>
        <h1>Hub Details: {detail.name}</h1>
        <Grid>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.name}>Name</TextField>
            <TextField readOnly value={detail.region || ''}>Region</TextField>
            <TextField readOnly value={detail.extensionType || ''}>Extension Type</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminHubDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminHubDetails {...props} />);
}
