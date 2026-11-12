import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';

export interface IRequestConfig {
    method: string;
    url: string;
    data?: any;
}

/** Describes how a list endpoint paginates: extra query params for the first page, and params for the next page (if any). */
export interface IPagingStrategy {
    first?: Record<string, string>;
    next(page: any): Record<string, string> | undefined;
}

/** Pagination via a `paginationToken` in the response, passed back as the `page` query parameter (Design Automation). */
export const PAGINATION_TOKEN_PAGING: IPagingStrategy = {
    next: page => page?.paginationToken ? { page: page.paginationToken } : undefined
};

/** Pagination via a `pagination.cursor` in the response, passed back as the `cursor` query parameter (Team Admin). */
export function cursorPaging(limit: number): IPagingStrategy {
    return {
        first: { limit: String(limit) },
        next: page => page?.pagination?.hasMore && page.pagination.cursor
            ? { limit: String(limit), cursor: page.pagination.cursor }
            : undefined
    };
}

/**
 * Minimal `fetch`-based REST client shared by services that have no official `@aps_sdk/*` SDK. Adds a bearer
 * token from the authentication provider (for the given scopes), serializes JSON bodies, parses responses
 * (falling back to plain text), and throws errors with an axios-shaped `response` property so that
 * `showErrorMessage` can display them.
 */
export class RestClient {
    constructor(
        private readonly baseUrl: string,
        private readonly authenticationProvider: IAuthenticationProvider,
        private readonly scopes: string[]
    ) {}

    async request<T>(config: IRequestConfig): Promise<T> {
        const token = await this.authenticationProvider.getAccessToken(this.scopes);
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        let body: string | undefined;
        if (config.data !== undefined) {
            body = JSON.stringify(config.data);
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(`${this.baseUrl}${config.url}`, { method: config.method, headers, body });
        const text = await response.text();
        let data: any;
        try {
            data = text ? JSON.parse(text) : undefined;
        } catch {
            data = text;
        }
        if (!response.ok) {
            const apiMessage = data?.message ?? data?.messages;
            const err: any = new Error(`Request failed with status code ${response.status}${apiMessage ? `: ${apiMessage}` : ''}`);
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => { responseHeaders[key] = value; });
            err.response = { config, data, headers: responseHeaders, status: response.status, statusText: response.statusText };
            throw err;
        }
        return data as T;
    }

    /** Fetches every page of a list endpoint and returns the flattened `data` array. */
    async getAllPages<T>(path: string, paging: IPagingStrategy, query: Record<string, string> = {}): Promise<T[]> {
        let results: T[] = [];
        let params: Record<string, string> | undefined = { ...query, ...paging.first };
        do {
            const search = new URLSearchParams(params).toString();
            const page: { data?: T[] } = await this.request<{ data?: T[] }>({ method: 'GET', url: search ? `${path}?${search}` : path });
            results = results.concat(page.data ?? []);
            const next = paging.next(page);
            params = next ? { ...query, ...next } : undefined;
        } while (params);
        return results;
    }
}
