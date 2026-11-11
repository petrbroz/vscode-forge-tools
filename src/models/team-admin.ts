// Types for the Team Admin API (https://aps.autodesk.com/en/docs/team_admin/v1/). There is no official
// `@aps_sdk/*` package for this API, so the REST shapes are declared here by hand.

/** The role a user holds on a team. */
export type TeamUserRole = 'PRIMARY_ADMIN' | 'SECONDARY_ADMIN' | 'SSO_ADMIN' | 'USER' | 'EXTERNAL_USER';

/** How a user holds a product: inherited from the whole team, assigned directly, or inherited through a group. */
export type TeamAssignmentType = 'TEAM' | 'DIRECT' | 'GROUP';

/** A team the signed-in user administers (`GET /teams`). */
export interface TeamDetails {
    id: string;
    name: string;
}

/** A user on a team (`GET /teams/{team-id}/users[/{user-id}]`). */
export interface TeamUserDetails {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: TeamUserRole;
    isEmailVerified: boolean;
}

/** A team's seats for one product (`GET /teams/{team-id}/product-pools`). Seat counts are `null` for unlimited pools, and `assignedQuantity` can be `null` for future-dated ones. */
export interface TeamProductPoolDetails {
    productId: string;
    teamId: string;
    productName: string | null;
    totalQuantity: number | null;
    assignedQuantity: number | null;
    unlimited: boolean;
    startDate: string;
    endDate: string;
}

/** A user's access to a product (`GET /teams/{team-id}/assignments`). */
export interface TeamAssignmentDetails {
    userId: string;
    email: string;
    teamId: string;
    productId: string;
    productName: string | null;
    assignmentType: TeamAssignmentType;
}

/** Body of `POST /teams/{team-id}/users`. `firstName`/`lastName` are only used when the email has no Autodesk account yet. */
export interface TeamUserInvite {
    email: string;
    firstName?: string;
    lastName?: string;
}

export enum EntryType {
    Team = 'team-admin-team',
    UsersCategory = 'team-admin-users-category',
    ProductPoolsCategory = 'team-admin-product-pools-category',
    User = 'team-admin-user',
    ProductPool = 'team-admin-product-pool',
    Assignment = 'team-admin-assignment',
    DirectAssignment = 'team-admin-assignment-direct'
}

export interface ITeamAdminTeam {
    type: EntryType.Team;
    id: string;
    name: string;
}

export interface ITeamAdminUsersCategory {
    type: EntryType.UsersCategory;
    teamId: string;
}

export interface ITeamAdminProductPoolsCategory {
    type: EntryType.ProductPoolsCategory;
    teamId: string;
}

export interface ITeamAdminUser {
    type: EntryType.User;
    teamId: string;
    id: string;
    name: string;
    email: string;
    role: TeamUserRole;
    isEmailVerified: boolean;
}

export interface ITeamAdminProductPool {
    type: EntryType.ProductPool;
    teamId: string;
    productId: string;
    productName: string;
    totalQuantity: number | null;
    assignedQuantity: number | null;
    unlimited: boolean;
    startDate: string;
    endDate: string;
}

/** A user holding a seat from a product pool. Only `DirectAssignment` entries can be removed through the API. */
export interface ITeamAdminAssignment {
    type: EntryType.Assignment | EntryType.DirectAssignment;
    teamId: string;
    userId: string;
    email: string;
    productId: string;
    productName: string;
    assignmentType: TeamAssignmentType;
}
