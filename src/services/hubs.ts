import { DataManagementClient } from '@aps_sdk/data-management';
import { IHub, IProject, IFolder, IItem, IVersion, IPage } from '../models/hubs';
import { Manifest, IDerivative } from '../models/model-derivative';
import { ModelDerivativeService } from './model-derivative';

/**
 * `next` (when present) is a full JSON:API pagination URL; this extracts the `page[number]` query
 * param to feed back into the next request's `pageNumber` option.
 */
function nextPageNumber(next?: { href?: string }): number | undefined {
    if (!next?.href) {
        return undefined;
    }
    const value = new URL(next.href).searchParams.get('page[number]');
    return value ? parseInt(value, 10) : undefined;
}

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

    /** Lists one page of a hub's projects, starting at the given page number (if any). */
    async getProjectsPage(hubId: string, pageNumber?: number, limit?: number): Promise<IPage<IProject>> {
        const projects = await this.client.getHubProjects(hubId, { pageNumber, pageLimit: limit });
        return {
            items: (projects.data ?? []).map(project => ({
                kind: 'project',
                hubId,
                id: project.id,
                name: project.attributes.name || '<no name>'
            })),
            nextPageNumber: nextPageNumber(projects.links?.next)
        };
    }

    /** Lists every project of a hub, paginating internally via {@link getProjectsPage}. */
    async getProjects(hubId: string): Promise<IProject[]> {
        const items: IProject[] = [];
        let pageNumber: number | undefined;
        do {
            const page = await this.getProjectsPage(hubId, pageNumber);
            items.push(...page.items);
            pageNumber = page.nextPageNumber;
        } while (pageNumber !== undefined);
        return items;
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

    /** Lists one page of a folder's contents (sub-folders and items), starting at the given page number (if any). */
    async getFolderContentsPage(projectId: string, folderId: string, pageNumber?: number, limit?: number): Promise<IPage<IFolder | IItem>> {
        const contents = await this.client.getFolderContents(projectId, folderId, { pageNumber, pageLimit: limit });
        const items = (contents.data ?? []).map(item => {
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
        return { items, nextPageNumber: nextPageNumber(contents.links?.next) };
    }

    /** Lists every item in a folder, paginating internally via {@link getFolderContentsPage}. */
    async getFolderContents(projectId: string, folderId: string): Promise<(IFolder | IItem)[]> {
        const items: (IFolder | IItem)[] = [];
        let pageNumber: number | undefined;
        do {
            const page = await this.getFolderContentsPage(projectId, folderId, pageNumber);
            items.push(...page.items);
            pageNumber = page.nextPageNumber;
        } while (pageNumber !== undefined);
        return items;
    }

    /** Lists one page of an item's versions, starting at the given page number (if any). */
    async getItemVersionsPage(projectId: string, itemId: string, pageNumber?: number, limit?: number): Promise<IPage<IVersion>> {
        const versions = await this.client.getItemVersions(projectId, itemId, { pageNumber, pageLimit: limit });
        return {
            items: (versions.data ?? []).map(version => ({
                kind: 'version',
                itemId,
                id: version.id,
                name: version.attributes.lastModifiedTime || version.attributes.createTime || '<no name>'
            })),
            nextPageNumber: nextPageNumber(versions.links?.next)
        };
    }

    /** Lists every version of an item, paginating internally via {@link getItemVersionsPage}. */
    async getItemVersions(projectId: string, itemId: string): Promise<IVersion[]> {
        const items: IVersion[] = [];
        let pageNumber: number | undefined;
        do {
            const page = await this.getItemVersionsPage(projectId, itemId, pageNumber);
            items.push(...page.items);
            pageNumber = page.nextPageNumber;
        } while (pageNumber !== undefined);
        return items;
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
