import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { TextField, TextArea, Divider } from './components/controls';
import { Issue, IssueComment } from '../models/issues';
import { Grid } from './components/Grid';

export interface IIssueDetailsProps {
    detail: Issue;
    comments?: IssueComment[];
}

const Comment = ({ comment }: { comment: IssueComment }) => (
    <div>
        <p>
            <strong>{comment.createdBy || '<unknown>'}</strong>
            {comment.createdAt && <span> &middot; {comment.createdAt}</span>}
        </p>
        <TextArea readOnly resize="vertical" rows={3} value={comment.body || ''} style={{ width: '100%' }} />
    </div>
);

const IssueDetails = ({ detail, comments }: IIssueDetailsProps) => (
    <div>
        <h1>Issue Details: #{detail.displayId} {detail.title}</h1>
        <Grid>
            <TextField readOnly value={detail.id}>ID</TextField>
            <TextField readOnly value={(detail.displayId ?? '').toString()}>Display ID</TextField>
            <TextField readOnly value={detail.status}>Status</TextField>
            <TextField readOnly value={detail.assignedTo || '<none>'}>Assigned To</TextField>
            <TextField readOnly value={detail.assignedToType || '<none>'}>Assigned To Type</TextField>
            <TextField readOnly value={detail.startDate || '<none>'}>Start Date</TextField>
            <TextField readOnly value={detail.dueDate || '<none>'}>Due Date</TextField>
            <TextField readOnly value={detail.locationDetails || '<none>'}>Location</TextField>
            <TextField readOnly value={detail.createdBy || '<none>'}>Created By</TextField>
            <TextField readOnly value={detail.createdAt || '<none>'}>Created At</TextField>
            <TextField readOnly value={detail.updatedBy || '<none>'}>Updated By</TextField>
            <TextField readOnly value={detail.updatedAt || '<none>'}>Updated At</TextField>
            <TextField readOnly value={detail.closedBy || '<none>'}>Closed By</TextField>
            <TextField readOnly value={detail.closedAt || '<none>'}>Closed At</TextField>
            <TextField readOnly value={(detail.commentCount ?? 0).toString()}>Comments</TextField>
            <TextField readOnly value={(detail.watchers ?? []).join(', ') || '<none>'}>Watchers</TextField>
        </Grid>

        <h2>Description</h2>
        <TextArea readOnly resize="vertical" rows={6} value={detail.description || '<no description>'} style={{ width: '100%' }} />

        {comments && comments.length > 0 && (
            <div>
                <h2>Comments ({comments.length})</h2>
                {comments.map((comment, i) => (
                    <div key={comment.id ?? i}>
                        <Comment comment={comment} />
                        {i < comments.length - 1 && <Divider />}
                    </div>
                ))}
            </div>
        )}
    </div>
);

export function render(container: HTMLElement, props: IIssueDetailsProps) {
    ReactDOM.createRoot(container).render(<IssueDetails {...props} />);
}
