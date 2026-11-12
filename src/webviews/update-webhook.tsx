import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { TextField, Button } from './components/controls';
import { HookDetails } from '../models/webhooks';
import { Grid } from './components/Grid';
import { postMessage } from './common';
import { Actions } from './components/Actions';

export type IUpdateWebhookMessage = {
    command: 'update';
    webhook: { filter: string; attributes: string; };
};

export interface IUpdateWebhookProps {
    detail: HookDetails & { filter?: string; };
}

const UpdateWebhook = ({ detail }: IUpdateWebhookProps) => {
    const [filter, setFilter] = useState(detail.filter || '');
    const [attributes, setAttributes] = useState(detail.hookAttribute ? JSON.stringify(detail.hookAttribute) : '');

    function updateWebhook() {
        postMessage<IUpdateWebhookMessage>({
            command: 'update',
            webhook: { filter, attributes }
        });
    }

    return (
        <div>
            <h1>Update Webhook: {detail.hookId}</h1>
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

                <TextField value={filter} onChange={ev => setFilter((ev.target as any).value)}>Filter</TextField>
                <TextField value={attributes} onChange={ev => setAttributes((ev.target as any).value)}>Attributes</TextField>
            </Grid>

            <Actions>
                <Button onClick={updateWebhook}>Update</Button>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: IUpdateWebhookProps) {
    ReactDOM.createRoot(container).render(<UpdateWebhook {...props} />);
}