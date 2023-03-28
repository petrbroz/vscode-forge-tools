import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { IObject } from 'forge-server-utils';
import { Grid } from './components/Grid';

export interface IObjectDetailsProps {
    detail: IObject;
}

const ObjectDetails = ({ detail }: IObjectDetailsProps) => (
    <div>
        <h1>Object Details: {detail.objectKey}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.bucketKey}>Bucket Key</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.objectKey}>Object Key</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.objectId}>Object ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.size.toString()}>Size</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.sha1}>SHA1</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.location}>Location</VSCodeTextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IObjectDetailsProps) {
    ReactDOM.createRoot(container).render(<ObjectDetails {...props} />);
}