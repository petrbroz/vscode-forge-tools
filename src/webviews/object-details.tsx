import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField } from './components/controls';
import { ObjectFullDetails } from '../models/oss';
import { Grid } from './components/Grid';

export interface IObjectDetailsProps {
    detail: ObjectFullDetails;
}

const ObjectDetails = ({ detail }: IObjectDetailsProps) => (
    <div>
        <h1>Object Details: {detail.objectKey}</h1>
        <Grid>
            <TextField readOnly value={detail.bucketKey}>Bucket Key</TextField>
            <TextField readOnly value={detail.objectKey}>Object Key</TextField>
            <TextField readOnly value={detail.objectId}>Object ID</TextField>
            <TextField readOnly value={(detail.size ?? 0).toString()}>Size</TextField>
            <TextField readOnly value={detail.sha1}>SHA1</TextField>
            <TextField readOnly value={detail.location}>Location</TextField>
        </Grid>
    </div>
);

export function render(container: HTMLElement, props: IObjectDetailsProps) {
    ReactDOM.createRoot(container).render(<ObjectDetails {...props} />);
}