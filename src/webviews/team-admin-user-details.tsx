import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeDataGrid, VSCodeDataGridCell, VSCodeDataGridRow, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { ITeamAdminAssignment, TeamUserDetails } from '../models/team-admin';
import { Grid } from './components/Grid';

export interface ITeamAdminUserDetailsProps {
    detail: TeamUserDetails;
    assignments: ITeamAdminAssignment[];
}

const TeamAdminUserDetailsView = ({ detail, assignments }: ITeamAdminUserDetailsProps) => {
    const name = [detail.firstName, detail.lastName].filter(Boolean).join(' ') || detail.email;
    return (
        <div>
            <h1>Team User Details: {name}</h1>
            <Grid columns={'1fr 1fr'}>
                <VSCodeTextField readOnly value={detail.id}>ID</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.email}>E-mail</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.firstName || ''}>First Name</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.lastName || ''}>Last Name</VSCodeTextField>

                <VSCodeTextField readOnly value={detail.role}>Role</VSCodeTextField>
                <VSCodeTextField readOnly value={detail.isEmailVerified ? 'No' : 'Yes'}>Registration Pending</VSCodeTextField>
            </Grid>
            <h2>Product Assignments</h2>
            {assignments.length === 0
                ? <p>No product assignments.</p>
                : (
                    <VSCodeDataGrid gridTemplateColumns="2fr 1fr 2fr">
                        <VSCodeDataGridRow row-type="header">
                            <VSCodeDataGridCell cell-type="columnheader" grid-column="1">Product</VSCodeDataGridCell>
                            <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Type</VSCodeDataGridCell>
                            <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Product ID</VSCodeDataGridCell>
                        </VSCodeDataGridRow>
                        {assignments.map(assignment => (
                            <VSCodeDataGridRow key={assignment.productId}>
                                <VSCodeDataGridCell grid-column="1">{assignment.productName}</VSCodeDataGridCell>
                                <VSCodeDataGridCell grid-column="2">{assignment.assignmentType}</VSCodeDataGridCell>
                                <VSCodeDataGridCell grid-column="3">{assignment.productId}</VSCodeDataGridCell>
                            </VSCodeDataGridRow>
                        ))}
                    </VSCodeDataGrid>
                )}
        </div>
    );
};

export function render(container: HTMLElement, props: ITeamAdminUserDetailsProps) {
    ReactDOM.createRoot(container).render(<TeamAdminUserDetailsView {...props} />);
}
