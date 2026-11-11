import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { HubAdminProjectDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminProjectDetailsProps {
    detail: HubAdminProjectDetails;
}

const HubAdminProjectDetailsView = ({ detail }: IHubAdminProjectDetailsProps) => (
    <div>
        <h1>Project Details: {detail.name}</h1>
        <Grid columns={'1fr 1fr'}>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.name}>Name</TextField>

            <TextField readOnly value={detail.status || ''}>Status</TextField>
            <TextField readOnly value={detail.type || ''}>Type</TextField>

            <TextField readOnly value={detail.classification || ''}>Classification</TextField>
            <TextField readOnly value={detail.jobNumber || ''}>Job Number</TextField>

            <TextField readOnly value={detail.startDate || ''}>Start Date</TextField>
            <TextField readOnly value={detail.endDate || ''}>End Date</TextField>

            <TextField readOnly value={[detail.addressLine1, detail.city, detail.stateOrProvince, detail.country].filter(Boolean).join(', ')}>Address</TextField>
            <TextField readOnly value={detail.platform || ''}>Platform</TextField>

            <TextField readOnly value={(detail.memberCount ?? '').toString()}>Members</TextField>
            <TextField readOnly value={(detail.companyCount ?? '').toString()}>Companies</TextField>

            <TextField readOnly value={detail.createdAt || ''}>Created At</TextField>
            <TextField readOnly value={detail.updatedAt || ''}>Updated At</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminProjectDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminProjectDetailsView {...props} />);
}
