import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { HubAdminCompanyDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminCompanyDetailsProps {
    detail: HubAdminCompanyDetails;
}

const HubAdminCompanyDetailsView = ({ detail }: IHubAdminCompanyDetailsProps) => (
    <div>
        <h1>Company Details: {detail.name}</h1>
        <Grid columns={'1fr 1fr'}>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.name}>Name</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.trade || ''}>Trade</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.website_url || ''}>Website</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.phone || ''}>Phone</VSCodeTextField>
            <VSCodeTextField readOnly value={[detail.address_line_1, detail.city, detail.state_or_province, detail.country].filter(Boolean).join(', ')}>Address</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.erp_id || ''}>ERP ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.tax_id || ''}>Tax ID</VSCodeTextField>

            <VSCodeTextField readOnly value={detail.description || ''}>Description</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminCompanyDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminCompanyDetailsView {...props} />);
}
