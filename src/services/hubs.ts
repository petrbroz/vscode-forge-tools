import { DataManagementClient } from '@aps_sdk/data-management';
import { IHub, IProject, IFolder, IItem, IVersion } from '../models/hubs';
import { Manifest, IDerivative } from '../models/model-derivative';
import { ModelDerivativeService } from './model-derivative';

/**
 * Domain logic for the Data Management "Hubs" hierarchy (hubs > projects > folders > items >
 * versions). Wraps a `DataManagementClient` (running in a user context via the 3-legged token when
 * available) and exposes plain, domain-shaped operations so the vscode layers never touch the SDK's
 * client or response shapes. Version derivatives are delegated to the {@link ModelDerivativeService}
 * so the manifest transform lives in one place.
 */
export class HubsService {
    constructor(
        private readonly client: DataManagementClient,
        private readonly modelDerivativeService: ModelDerivativeService
    ) {}

    /** Lists all hubs accessible to the current user. */
    async getHubs(): Promise<IHub[]> {
        const hubs = await this.client.getHubs();
        return (hubs.data ?? []).map(hub => ({
            kind: 'hub',
            id: hub.id!,
            name: hub.attributes?.name || '<no name>'
        }));
    }

    /** Lists the projects of a hub. */
    async getProjects(hubId: string): Promise<IProject[]> {
        const projects = await this.client.getHubProjects(hubId);
        return (projects.data ?? []).map(project => ({
            kind: 'project',
            hubId,
            id: project.id,
            name: project.attributes.name || '<no name>'
        }));
    }

    /** Lists the top-level folders of a project. Hidden folders are prefixed with `(hidden)`. */
    async getTopFolders(hubId: string, projectId: string): Promise<IFolder[]> {
        const folders = await this.client.getProjectTopFolders(hubId, projectId);
        return (folders.data ?? []).map(folder => {
            const entry: IFolder = {
                kind: 'folder',
                projectId,
                id: folder.id,
                name: folder.attributes.name || '<no name>'
            };
            if (folder.attributes.hidden) {
                entry.name = '(hidden) ' + entry.name;
            }
            return entry;
        });
    }

    /** Lists the contents of a folder (sub-folders and items). */
    async getFolderContents(projectId: string, folderId: string): Promise<(IFolder | IItem)[]> {
        const contents = await this.client.getFolderContents(projectId, folderId);
        return (contents.data ?? []).map(item => {
            switch (item.type) {
                case 'folders':
                    const folder: IFolder = {
                        kind: 'folder',
                        projectId,
                        id: item.id,
                        name: item.attributes.name || '<no name>'
                    };
                    return folder;
                case 'items':
                    const file: IItem = {
                        kind: 'item',
                        projectId,
                        id: item.id,
                        name: item.attributes.displayName || '<no name>'
                    };
                    return file;
                default:
                    throw new Error('Unexpected item type.');
            }
        });
    }

    /** Lists the versions of an item. */
    async getItemVersions(projectId: string, itemId: string): Promise<IVersion[]> {
        const versions = await this.client.getItemVersions(projectId, itemId);
        return (versions.data ?? []).map(version => ({
            kind: 'version',
            itemId,
            id: version.id,
            name: version.attributes.lastModifiedTime || version.attributes.createTime || '<no name>'
        }));
    }

    /** Fetches the manifest of a version (used to check translation status before listing derivatives). */
    getVersionManifest(versionId: string): Promise<Manifest> {
        return this.modelDerivativeService.getVersionManifest(versionId);
    }

    /**
     * Viewable (geometry) derivatives of a version. Throws if the version isn't fully translated. Pass
     * an already-fetched `manifest` (e.g. from {@link getVersionManifest}) to avoid re-fetching it.
     */
    getVersionDerivatives(versionId: string, manifest?: Manifest): Promise<IDerivative[]> {
        return this.modelDerivativeService.getVersionDerivatives(versionId, manifest);
    }
}
