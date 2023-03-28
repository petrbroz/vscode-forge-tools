import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IAlias } from 'forge-server-utils';
import { Grid } from './components/Grid';

export interface IAliasDetailsProps {
    detail: IAlias;
}

const AliasDetails = ({ detail }: IAliasDetailsProps) => (
    <div>
        <h1>Alias Details: {detail.id}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.version.toString()}>Version</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.receiver || ''}>Receiver</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IAliasDetailsProps) {
    ReactDOM.createRoot(container).render(<AliasDetails {...props} />);
}