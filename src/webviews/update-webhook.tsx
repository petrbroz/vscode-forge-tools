import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { VSCodeTextField, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { IWebhook } from 'aps-sdk-node';
import { Grid } from './components/Grid';
import { postMessage } from './common';
import { Actions } from './components/Actions';

export interface IUpdateWebhookProps {
    detail: IWebhook & { filter?: string; hookAttribute?: string; };
    scopes: string[];
}

const UpdateWebhook = ({ detail, scopes }: IUpdateWebhookProps) => {
    const [filter, setFilter] = useState(detail.filter || '');
    const [attributes, setAttributes] = useState(detail.hookAttribute ? JSON.stringify(detail.hookAttribute) : '');

    function updateWebhook() {
        postMessage({
            command: 'update',
            webhook: { filter, attributes }
        });
    }

    return (
        <div>
            <h1>Update Webhook: {detail.hookId}</h1>
            <Grid columns={'1fr 1fr'}>
                <VSCodeTextField readOnly value={detail.hookId}>ID</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.status}>Status</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.system}>System</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.event}>Event</VSCodeTextField>  

                <VSCodeTextField readOnly value={detail.createdBy}>Created By</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.createdDate}>Created On</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.urn}>URN</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.tenant}>Tenant</VSCodeTextField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                    <VSCodeTextField readOnly value={Object.keys(detail.scope)[0]}>Scope</VSCodeTextField>
                    <VSCodeTextField readOnly value={Object.values(detail.scope)[0]}></VSCodeTextField>
                </div>
                <VSCodeTextField readOnly value={detail.callbackUrl}>Callback URL</VSCodeTextField>

                <VSCodeTextField value={filter} onChange={ev => setFilter((ev.target as any).value)}>Filter</VSCodeTextField>
                <VSCodeTextField value={attributes} onChange={ev => setAttributes((ev.target as any).value)}>Attributes</VSCodeTextField>
            </Grid>

            <Actions>
                <VSCodeButton onClick={updateWebhook}>Update</VSCodeButton>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: IUpdateWebhookProps) {
    ReactDOM.createRoot(container).render(<UpdateWebhook {...props} />);
}