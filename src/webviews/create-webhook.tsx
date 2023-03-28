import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
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
                <VSCodeTextField readOnly value={system}>System</VSCodeTextField>
                <VSCodeTextField readOnly value={event}>Event</VSCodeTextField>  

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                    <VSCodeTextField value={scopeValue} onChange={ev => setScopeValue((ev.target as any).value)}>Scope</VSCodeTextField>
                    <VSCodeDropdown value={scopeKey} onChange={ev => setScopeKey((ev.target as any).value)}>
                        {scopes.map(scope => <VSCodeOption value={scope}>{scope}</VSCodeOption>)}
                    </VSCodeDropdown>
                </div>
                <VSCodeTextField value={callbackUrl} onChange={ev => setCallbackUrl((ev.target as any).value)}>Callback URL</VSCodeTextField>

                <VSCodeTextField value={filter} onChange={ev => setFilter((ev.target as any).value)}>Filter</VSCodeTextField>
                <VSCodeTextField value={attributes} onChange={ev => setAttributes((ev.target as any).value)}>Attributes</VSCodeTextField>
            </Grid>

            <Actions>
                <VSCodeButton onClick={createWebhook}>Create</VSCodeButton>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: ICreateWebhookProps) {
    ReactDOM.createRoot(container).render(<CreateWebhook {...props} />);
}