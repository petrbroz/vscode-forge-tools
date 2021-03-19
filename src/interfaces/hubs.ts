export interface IHint {
    hint: string;
    tooltip?: string;
}

export interface IHub {
    kind: 'hub';
    id: string;
    name: string;
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
    name: string;
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