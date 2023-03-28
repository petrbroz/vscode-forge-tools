import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IAppBundleDetail } from 'forge-server-utils';
import { Grid } from './components/Grid';

export interface IAppBundleDetailsProps {
    detail: IAppBundleDetail;
}

const AppBundleDetails = ({ detail }: IAppBundleDetailsProps) => (
    <div>
        <h1>App Bundle Details: {detail.id}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.version.toString()}>Version</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.engine}>Engine</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.description}>Description</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.package || ''}>Package</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IAppBundleDetailsProps) {
    ReactDOM.createRoot(container).render(<AppBundleDetails {...props} />);
}