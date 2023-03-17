import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IWebhook } from 'forge-server-utils';

export interface IWebhookDetailsProps {
    detail: IWebhook & { filter?: string; hookAttribute?: string; };
}

const WebhookDetails = ({ detail }: IWebhookDetailsProps) => (
    <div>
        <h1>Webhook Details: {detail.hookId}</h1>
        <div style={{ display: 'grid', gap: '1em', gridTemplateColumns: '1fr 1fr' }}>
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

            <VSCodeTextField readOnly value={detail.filter || ''}>Filter</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.hookAttribute ? JSON.stringify(detail.hookAttribute) : ''}>Attributes</VSCodeTextField>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IWebhookDetailsProps) {
    ReactDOM.createRoot(container).render(<WebhookDetails {...props} />);
}