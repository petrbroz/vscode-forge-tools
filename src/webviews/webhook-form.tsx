import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { TextField, Dropdown, Option, Button } from './components/controls';
import { HookDetails } from '../models/webhooks';
import { Grid } from './components/Grid';
import { postMessage } from './common';
import { Actions } from './components/Actions';

export type IWebhookFormMessage =
    | { command: 'create'; webhook: { scopeKey: string; scopeValue: string; callbackUrl: string; filter: string; attributes: string; } }
    | { command: 'update'; webhook: { filter: string; attributes: string; } };

export interface IWebhookFormProps {
    system: string;
    event: string;
    scopes: string[];
    initial?: HookDetails & { filter?: string; };
}

const WebhookForm = ({ system, event, scopes, initial }: IWebhookFormProps) => {
    const [scopeKey, setScopeKey] = useState(scopes[0]);
    const [scopeValue, setScopeValue] = useState('');
    const [callbackUrl, setCallbackUrl] = useState('');
    const [filter, setFilter] = useState(initial?.filter || '');
    const [attributes, setAttributes] = useState(initial?.hookAttribute ? JSON.stringify(initial.hookAttribute) : '');

    function submit() {
        postMessage<IWebhookFormMessage>(initial
            ? { command: 'update', webhook: { filter, attributes } }
            : { command: 'create', webhook: { scopeKey, scopeValue, callbackUrl, filter, attributes } });
    }

    return (
        <div>
            <h1>{initial ? `Update Webhook: ${initial.hookId}` : 'Create Webhook'}</h1>
            <Grid columns={'1fr 1fr'}>
                {initial && <>
                    <TextField readOnly value={initial.hookId}>ID</TextField>
                    <TextField readOnly value={initial.status}>Status</TextField>
                </>}

                <TextField readOnly value={system}>System</TextField>
                <TextField readOnly value={event}>Event</TextField>

                {initial && <>
                    <TextField readOnly value={initial.createdBy}>Created By</TextField>
                    <TextField readOnly value={initial.createdDate}>Created On</TextField>

                    <TextField readOnly value={initial.urn}>URN</TextField>
                    <TextField readOnly value={initial.tenant}>Tenant</TextField>
                </>}

                {initial ? <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                        <TextField readOnly value={Object.keys(initial.scope ?? {})[0]}>Scope</TextField>
                        <TextField readOnly value={Object.values(initial.scope ?? {})[0]}></TextField>
                    </div>
                    <TextField readOnly value={initial.callbackUrl}>Callback URL</TextField>
                </> : <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                        <TextField value={scopeValue} onChange={ev => setScopeValue((ev.target as any).value)}>Scope</TextField>
                        <Dropdown value={scopeKey} onChange={ev => setScopeKey((ev.target as any).value)}>
                            {scopes.map(scope => <Option value={scope}>{scope}</Option>)}
                        </Dropdown>
                    </div>
                    <TextField value={callbackUrl} onChange={ev => setCallbackUrl((ev.target as any).value)}>Callback URL</TextField>
                </>}

                <TextField value={filter} onChange={ev => setFilter((ev.target as any).value)}>Filter</TextField>
                <TextField value={attributes} onChange={ev => setAttributes((ev.target as any).value)}>Attributes</TextField>
            </Grid>

            <Actions>
                <Button onClick={submit}>{initial ? 'Update' : 'Create'}</Button>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: IWebhookFormProps) {
    ReactDOM.createRoot(container).render(<WebhookForm {...props} />);
}
