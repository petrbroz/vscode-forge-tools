// Re-export the OSS SDK types that the vscode layers (commands/providers/webviews) need, so those
// layers depend on `src/models` instead of importing `@aps_sdk/oss` directly.
export type { BucketsItems, ObjectDetails, Bucket, ObjectFullDetails } from '@aps_sdk/oss';

/** Access levels for a signed resource, in plain domain form (the SDK's `Access` enum stays inside the service). */
export type SignedUrlAccess = 'read' | 'write' | 'readwrite';

/** One page of paginated OSS results, plus an opaque continuation token for the next page (if any). */
export interface IPage<T> {
    items: T[];
    nextStartAt?: string;
}
