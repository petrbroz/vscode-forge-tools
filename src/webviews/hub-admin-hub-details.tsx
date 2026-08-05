import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IHubDetails } from '../models/hubs';
import { Grid } from './components/Grid';

export interface IHubAdminHubDetailsProps {
    detail: IHubDetails;
}

const HubAdminHubDetails = ({ detail }: IHubAdminHubDetailsProps) => (
    <div>
        <h1>Hub Details: {detail.name}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.name}>Name</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.region || ''}>Region</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.extensionType || ''}>Extension Type</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminHubDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminHubDetails {...props} />);
}
