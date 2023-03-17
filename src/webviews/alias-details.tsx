import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IAlias } from 'forge-server-utils';

export interface IAliasDetailsProps {
    detail: IAlias;
}

const AliasDetails = ({ detail }: IAliasDetailsProps) => (
    <div>
        <h1>Alias Details: {detail.id}</h1>
        <div style={{ display: 'grid', gap: '1em' }}>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.version.toString()}>Version</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.receiver || ''}>Receiver</VSCodeTextField>
        </div>
    </div>
);

export function render(container: HTMLElement, props: IAliasDetailsProps) {
    ReactDOM.createRoot(container).render(<AliasDetails {...props} />);
}