import { OssClient, BucketsItems, ObjectDetails, Region } from '@aps_sdk/oss';

/**
 * `startAt` is an opaque continuation token (not the last item's key) since Autodesk's "List
 * Objects"/"List Buckets" API change - it must be read from the `next` URL's query string, not
 * reconstructed from item data, or the API rejects it with "Invalid startAt parameter".
 */
function nextStartAt(next: string | undefined): string | undefined {
    return next ? new URL(next).searchParams.get('startAt') ?? undefined : undefined;
}

/**
 * The official OSS SDK's `getBuckets`/`getObjects` return a single page (`{ items, next }`); the
 * legacy SDK client auto-paginated internally. These helpers loop on `next` to restore that
 * "list everything" behavior.
 */
export async function getAllBuckets(client: OssClient, region?: Region): Promise<BucketsItems[]> {
    const items: BucketsItems[] = [];
    let startAt: string | undefined;
    let next: string | undefined;
    do {
        const page = await client.getBuckets({ region, startAt });
        items.push(...page.items);
        next = page.next;
        startAt = nextStartAt(next);
    } while (next);
    return items;
}

export async function getAllObjects(client: OssClient, bucketKey: string): Promise<ObjectDetails[]> {
    const items: ObjectDetails[] = [];
    let startAt: string | undefined;
    let next: string | undefined;
    do {
        const page = await client.getObjects(bucketKey, { startAt });
        items.push(...(page.items ?? []));
        next = page.next;
        startAt = nextStartAt(next);
    } while (next);
    return items;
}
