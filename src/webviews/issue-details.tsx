import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField, VSCodeTextArea, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
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
        <VSCodeTextArea readOnly resize="vertical" rows={3} value={comment.body || ''} style={{ width: '100%' }} />
    </div>
);

const IssueDetails = ({ detail, comments }: IIssueDetailsProps) => (
    <div>
        <h1>Issue Details: #{detail.displayId} {detail.title}</h1>
        <Grid>
            <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
            <VSCodeTextField readOnly value={(detail.displayId ?? '').toString()}>Display ID</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.status}>Status</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.assignedTo || '<none>'}>Assigned To</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.assignedToType || '<none>'}>Assigned To Type</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.startDate || '<none>'}>Start Date</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.dueDate || '<none>'}>Due Date</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.locationDetails || '<none>'}>Location</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdBy || '<none>'}>Created By</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.createdAt || '<none>'}>Created At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.updatedBy || '<none>'}>Updated By</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.updatedAt || '<none>'}>Updated At</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.closedBy || '<none>'}>Closed By</VSCodeTextField>
            <VSCodeTextField readOnly value={detail.closedAt || '<none>'}>Closed At</VSCodeTextField>
            <VSCodeTextField readOnly value={(detail.commentCount ?? 0).toString()}>Comments</VSCodeTextField>
            <VSCodeTextField readOnly value={(detail.watchers ?? []).join(', ') || '<none>'}>Watchers</VSCodeTextField>
        </Grid>

        <h2>Description</h2>
        <VSCodeTextArea readOnly resize="vertical" rows={6} value={detail.description || '<no description>'} style={{ width: '100%' }} />

        {comments && comments.length > 0 && (
            <div>
                <h2>Comments ({comments.length})</h2>
                {comments.map((comment, i) => (
                    <div key={comment.id ?? i}>
                        <Comment comment={comment} />
                        {i < comments.length - 1 && <VSCodeDivider />}
                    </div>
                ))}
            </div>
        )}
    </div>
);

export function render(container: HTMLElement, props: IIssueDetailsProps) {
    ReactDOM.createRoot(container).render(<IssueDetails {...props} />);
}
