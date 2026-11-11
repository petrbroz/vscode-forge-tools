import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { DataGrid, DataGridCell, DataGridRow, TextField } from './components/controls';
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
                <TextField readOnly value={detail.id}>ID</TextField>
                <TextField readOnly value={detail.email}>E-mail</TextField>

                <TextField readOnly value={detail.firstName || ''}>First Name</TextField>
                <TextField readOnly value={detail.lastName || ''}>Last Name</TextField>

                <TextField readOnly value={detail.role}>Role</TextField>
                <TextField readOnly value={detail.isEmailVerified ? 'No' : 'Yes'}>Registration Pending</TextField>
            </Grid>
            <h2>Product Assignments</h2>
            {assignments.length === 0
                ? <p>No product assignments.</p>
                : (
                    <DataGrid gridTemplateColumns="2fr 1fr 2fr">
                        <DataGridRow row-type="header">
                            <DataGridCell cell-type="columnheader" grid-column="1">Product</DataGridCell>
                            <DataGridCell cell-type="columnheader" grid-column="2">Type</DataGridCell>
                            <DataGridCell cell-type="columnheader" grid-column="3">Product ID</DataGridCell>
                        </DataGridRow>
                        {assignments.map(assignment => (
                            <DataGridRow key={assignment.productId}>
                                <DataGridCell grid-column="1">{assignment.productName}</DataGridCell>
                                <DataGridCell grid-column="2">{assignment.assignmentType}</DataGridCell>
                                <DataGridCell grid-column="3">{assignment.productId}</DataGridCell>
                            </DataGridRow>
                        ))}
                    </DataGrid>
                )}
        </div>
    );
};

export function render(container: HTMLElement, props: ITeamAdminUserDetailsProps) {
    ReactDOM.createRoot(container).render(<TeamAdminUserDetailsView {...props} />);
}
