import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { IAlias } from '../models/design-automation-api';
import { Grid } from './components/Grid';

export interface IAliasDetailsProps {
    detail: IAlias;
}

const AliasDetails = ({ detail }: IAliasDetailsProps) => (
    <div>
        <h1>Alias Details: {detail.id}</h1>
        <Grid>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.version.toString()}>Version</TextField>
            <TextField readOnly value={detail.receiver || ''}>Receiver</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IAliasDetailsProps) {
    ReactDOM.createRoot(container).render(<AliasDetails {...props} />);
}