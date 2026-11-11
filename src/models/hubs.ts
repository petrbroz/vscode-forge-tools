export interface IHint {
    hint: string;
    tooltip?: string;
}

/** One page of a paginated Data Management list, plus the next page number to fetch (if any). */
export interface IPage<T> {
    items: T[];
    nextPageNumber?: number;
}

/** Synthetic leaf shown after a partial page of projects/folder contents/versions, to fetch the next page on click. */
export interface ILoadMore {
    loadMore: true;
    /** ID of the parent (hub/folder/item) whose next page this loads. */
    parentId: string;
}

export interface IHub {
    kind: 'hub';
    id: string;
    name: string;
}

/** Full attributes of a single hub, as shown by the "View Hub Details" action. */
export interface IHubDetails {
    id: string;
    name: string;
    region?: string;
    extensionType?: string;
}

export interface IProject {
    kind: 'project';
    hubId: string;
    id: string;
    name: string;
}

export interface IFolder {
    kind: 'folder';
    projectId: string;
    id: string;
    /** Tree label: `attributes.displayName` if present, otherwise `attributes.name`. */
    name: string;
    /** Raw `attributes.name`, set only when {@link name} came from `attributes.displayName` instead. */
    rawName?: string;
}

export interface IItem {
    kind: 'item';
    projectId: string;
    id: string;
    name: string;
}

export interface IVersion {
    kind: 'version';
    itemId: string;
    id: string;
    name: string;
}