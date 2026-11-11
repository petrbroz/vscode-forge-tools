import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { HookDetails } from '../models/webhooks';
import { Grid } from './components/Grid';

export interface IWebhookDetailsProps {
    detail: HookDetails & { filter?: string; hookAttribute?: string; };
}

const WebhookDetails = ({ detail }: IWebhookDetailsProps) => (
    <div>
        <h1>Webhook Details: {detail.hookId}</h1>
        <Grid columns={'1fr 1fr'}>
            <TextField readOnly value={detail.hookId}>ID</TextField>
            <TextField readOnly value={detail.status}>Status</TextField>

            <TextField readOnly value={detail.system}>System</TextField>
            <TextField readOnly value={detail.event}>Event</TextField>  

            <TextField readOnly value={detail.createdBy}>Created By</TextField>
            <TextField readOnly value={detail.createdDate}>Created On</TextField>

            <TextField readOnly value={detail.urn}>URN</TextField>
            <TextField readOnly value={detail.tenant}>Tenant</TextField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                <TextField readOnly value={Object.keys(detail.scope ?? {})[0]}>Scope</TextField>
                <TextField readOnly value={Object.values(detail.scope ?? {})[0]}></TextField>
            </div>
            <TextField readOnly value={detail.callbackUrl}>Callback URL</TextField>

            <TextField readOnly value={detail.filter || ''}>Filter</TextField>
            <TextField readOnly value={detail.hookAttribute ? JSON.stringify(detail.hookAttribute) : ''}>Attributes</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IWebhookDetailsProps) {
    ReactDOM.createRoot(container).render(<WebhookDetails {...props} />);
}