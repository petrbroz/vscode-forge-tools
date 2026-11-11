import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { HubAdminCompanyDetails } from '../models/hub-admin';
import { Grid } from './components/Grid';

export interface IHubAdminCompanyDetailsProps {
    detail: HubAdminCompanyDetails;
}

const HubAdminCompanyDetailsView = ({ detail }: IHubAdminCompanyDetailsProps) => (
    <div>
        <h1>Company Details: {detail.name}</h1>
        <Grid columns={'1fr 1fr'}>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.name}>Name</TextField>

            <TextField readOnly value={detail.trade || ''}>Trade</TextField>
            <TextField readOnly value={detail.website_url || ''}>Website</TextField>

            <TextField readOnly value={detail.phone || ''}>Phone</TextField>
            <TextField readOnly value={[detail.address_line_1, detail.city, detail.state_or_province, detail.country].filter(Boolean).join(', ')}>Address</TextField>

            <TextField readOnly value={detail.erp_id || ''}>ERP ID</TextField>
            <TextField readOnly value={detail.tax_id || ''}>Tax ID</TextField>

            <TextField readOnly value={detail.description || ''}>Description</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IHubAdminCompanyDetailsProps) {
    ReactDOM.createRoot(container).render(<HubAdminCompanyDetailsView {...props} />);
}
