import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { IAppBundleDetail } from '../models/design-automation-api';
import { Grid } from './components/Grid';

export interface IAppBundleDetailsProps {
    detail: IAppBundleDetail;
}

const AppBundleDetails = ({ detail }: IAppBundleDetailsProps) => (
    <div>
        <h1>App Bundle Details: {detail.id}</h1>
        <Grid>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={detail.version.toString()}>Version</TextField>
            <TextField readOnly value={detail.engine}>Engine</TextField>
            <TextField readOnly value={detail.description}>Description</TextField>
            <TextField readOnly value={detail.package || ''}>Package</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IAppBundleDetailsProps) {
    ReactDOM.createRoot(container).render(<AppBundleDetails {...props} />);
}