import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { HubAdminProjectDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminProjectDetailsProps {
    detail: HubAdminProjectDetails;
}

const HubAdminProjectDetailsView = ({ detail }: IHubAdminProjectDetailsProps) => (
    <div>
        <h1>Project Details: {detail.name}</h1>
        <Grid columns={'1fr 1fr'}>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.name}>Name</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.status || ''}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.type || ''}>Type</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.classification || ''}>Classification</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.jobNumber || ''}>Job Number</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.startDate || ''}>Start Date</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.endDate || ''}>End Date</VSCodeTextField>

            <VSCodeTextField readOnly value={[detail.addressLine1, detail.city, detail.stateOrProvince, detail.country].filter(Boolean).join(', ')}>Address</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.platform || ''}>Platform</VSCodeTextField>

            <VSCodeTextField readOnly value={(detail.memberCount ?? '').toString()}>Members</VSCodeTextField>
            <VSCodeTextField readOnly value={(detail.companyCount ?? '').toString()}>Companies</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.createdAt || ''}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.updatedAt || ''}>Updated At</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminProjectDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminProjectDetailsView {...props} />);
}
