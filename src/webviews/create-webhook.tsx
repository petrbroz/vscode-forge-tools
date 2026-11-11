import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { TextField, Dropdown, Option, Button } from './components/controls';
import { postMessage } from './common';
import { Grid } from './components/Grid';
import { Actions } from './components/Actions';

export interface ICreateWebhookProps {
    system: string;
    event: string;
    scopes: string[];
}

const CreateWebhook = ({ system, event, scopes }: ICreateWebhookProps) => {
    const [scopeKey, setScopeKey] = useState(scopes[0]);
    const [scopeValue, setScopeValue] = useState('');
    const [callbackUrl, setCallbackUrl] = useState('');
    const [filter, setFilter] = useState('');
    const [attributes, setAttributes] = useState('');

    function createWebhook() {
        postMessage({
            command: 'create',
            webhook: { scopeKey, scopeValue, callbackUrl, filter, attributes }
        });
    }

    return (
        <div>
            <h1>Create Webhook</h1>
            <Grid columns={'1fr 1fr'}>
                <TextField readOnly value={system}>System</TextField>
                <TextField readOnly value={event}>Event</TextField>  

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                    <TextField value={scopeValue} onChange={ev => setScopeValue((ev.target as any).value)}>Scope</TextField>
                    <Dropdown value={scopeKey} onChange={ev => setScopeKey((ev.target as any).value)}>
                        {scopes.map(scope => <Option value={scope}>{scope}</Option>)}
                    </Dropdown>
                </div>
                <TextField value={callbackUrl} onChange={ev => setCallbackUrl((ev.target as any).value)}>Callback URL</TextField>

                <TextField value={filter} onChange={ev => setFilter((ev.target as any).value)}>Filter</TextField>
                <TextField value={attributes} onChange={ev => setAttributes((ev.target as any).value)}>Attributes</TextField>
            </Grid>

            <Actions>
                <Button onClick={createWebhook}>Create</Button>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: ICreateWebhookProps) {
    ReactDOM.createRoot(container).render(<CreateWebhook {...props} />);
}