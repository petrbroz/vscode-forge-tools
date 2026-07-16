import { OssClient, BucketsItems, ObjectDetails, Bucket, ObjectFullDetails, CreateObjectSigned, Access, PolicyKey, Region } from '@aps_sdk/oss';
import { SignedUrlAccess } from '../models/oss';

/** Retention policies that can be assigned to a new bucket. */
const RetentionPolicyKeys = ['transient', 'temporary', 'persistent'];

/** Maps the plain domain access levels onto the SDK's `Access` enum. */
const SignedUrlAccessMap: { [key in SignedUrlAccess]: Access } = { read: Access.Read, write: Access.Write, readwrite: Access.ReadWrite };

/** Number of object deletions to run in parallel when emptying a bucket. */
const DeleteBatchSize = 8;

/** Common file extension -> MIME type mapping, offered when uploading/creating objects. */
const AllowedMimeTypes: { [ext: string]: string } = {
    'a': 'application/octet-stream',
    'ai': 'application/postscript',
    'aif': 'audio/x-aiff',
    'aifc': 'audio/x-aiff',
    'aiff': 'audio/x-aiff',
    'au': 'audio/basic',
    'avi': 'video/x-msvideo',
    'bat': 'text/plain',
    'bin': 'application/octet-stream',
    'bmp': 'image/x-ms-bmp',
    'c': 'text/plain',
    'cdf': 'application/x-cdf',
    'csh': 'application/x-csh',
    'css': 'text/css',
    'dll': 'application/octet-stream',
    'doc': 'application/msword',
    'dot': 'application/msword',
    'dvi': 'application/x-dvi',
    'eml': 'message/rfc822',
    'eps': 'application/postscript',
    'etx': 'text/x-setext',
    'exe': 'application/octet-stream',
    'gif': 'image/gif',
    'gtar': 'application/x-gtar',
    'h': 'text/plain',
    'hdf': 'application/x-hdf',
    'htm': 'text/html',
    'html': 'text/html',
    'jpe': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'js': 'application/x-javascript',
    'ksh': 'text/plain',
    'latex': 'application/x-latex',
    'm1v': 'video/mpeg',
    'man': 'application/x-troff-man',
    'me': 'application/x-troff-me',
    'mht': 'message/rfc822',
    'mhtml': 'message/rfc822',
    'mif': 'application/x-mif',
    'mov': 'video/quicktime',
    'movie': 'video/x-sgi-movie',
    'mp2': 'audio/mpeg',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'mpa': 'video/mpeg',
    'mpe': 'video/mpeg',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    'ms': 'application/x-troff-ms',
    'nc': 'application/x-netcdf',
    'nws': 'message/rfc822',
    'o': 'application/octet-stream',
    'obj': 'application/octet-stream',
    'oda': 'application/oda',
    'pbm': 'image/x-portable-bitmap',
    'pdf': 'application/pdf',
    'pfx': 'application/x-pkcs12',
    'pgm': 'image/x-portable-graymap',
    'png': 'image/png',
    'pnm': 'image/x-portable-anymap',
    'pot': 'application/vnd.ms-powerpoint',
    'ppa': 'application/vnd.ms-powerpoint',
    'ppm': 'image/x-portable-pixmap',
    'pps': 'application/vnd.ms-powerpoint',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.ms-powerpoint',
    'ps': 'application/postscript',
    'pwz': 'application/vnd.ms-powerpoint',
    'py': 'text/x-python',
    'pyc': 'application/x-python-code',
    'pyo': 'application/x-python-code',
    'qt': 'video/quicktime',
    'ra': 'audio/x-pn-realaudio',
    'ram': 'application/x-pn-realaudio',
    'ras': 'image/x-cmu-raster',
    'rdf': 'application/xml',
    'rgb': 'image/x-rgb',
    'roff': 'application/x-troff',
    'rtx': 'text/richtext',
    'sgm': 'text/x-sgml',
    'sgml': 'text/x-sgml',
    'sh': 'application/x-sh',
    'shar': 'application/x-shar',
    'snd': 'audio/basic',
    'so': 'application/octet-stream',
    'src': 'application/x-wais-source',
    'swf': 'application/x-shockwave-flash',
    't': 'application/x-troff',
    'tar': 'application/x-tar',
    'tcl': 'application/x-tcl',
    'tex': 'application/x-tex',
    'texi': 'application/x-texinfo',
    'texinfo': 'application/x-texinfo',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'tr': 'application/x-troff',
    'tsv': 'text/tab-separated-values',
    'txt': 'text/plain',
    'ustar': 'application/x-ustar',
    'vcf': 'text/x-vcard',
    'wav': 'audio/x-wav',
    'wiz': 'application/msword',
    'wsdl': 'application/xml',
    'xbm': 'image/x-xbitmap',
    'xlb': 'application/vnd.ms-excel',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.ms-excel',
    'xml': 'text/xml',
    'xpdl': 'application/xml',
    'xpm': 'image/x-xpixmap',
    'xsl': 'application/xml',
    'xwd': 'image/x-xwindowdump',
    'zip': 'application/zip'
};

export interface IUploadObjectOptions {
    contentType?: string;
    onProgress?: (percentCompleted: number) => void;
}

export interface IDeleteObjectsOptions {
    /** Called after each batch completes with the progress increment (0-100) contributed by that batch. */
    onProgress?: (increment: number) => void;
    /** Polled before each deletion; return `true` to stop early. */
    isCancelled?: () => boolean;
}

/**
 * `startAt` is an opaque continuation token (not the last item's key) since Autodesk's "List
 * Objects"/"List Buckets" API change - it must be read from the `next` URL's query string, not
 * reconstructed from item data, or the API rejects it with "Invalid startAt parameter".
 */
function nextStartAt(next: string | undefined): string | undefined {
    return next ? new URL(next).searchParams.get('startAt') ?? undefined : undefined;
}

/**
 * Domain logic for the Object Storage Service (OSS). Wraps an `OssClient` and exposes plain,
 * domain-shaped operations so the vscode layers never touch the SDK's clients, enums, or transforms.
 */
export class OssService {
    constructor(private readonly client: OssClient) {}

    /** Retention policy keys available when creating a bucket (for populating UI pickers). */
    get retentionPolicies(): string[] {
        return [...RetentionPolicyKeys];
    }

    /** Known content types offered when uploading/creating an object (for populating UI pickers). */
    get contentTypes(): string[] {
        return Object.values(AllowedMimeTypes);
    }

    /**
     * Lists every bucket owned by the application. The official OSS SDK's `getBuckets` returns a
     * single page (`{ items, next }`); this loops on `next` to restore "list everything" behavior.
     */
    async getAllBuckets(region?: string): Promise<BucketsItems[]> {
        const items: BucketsItems[] = [];
        let startAt: string | undefined;
        let next: string | undefined;
        do {
            const page = await this.client.getBuckets({ region: region as Region | undefined, startAt });
            items.push(...page.items);
            next = page.next;
            startAt = nextStartAt(next);
        } while (next);
        return items;
    }

    /** Lists every object in a bucket, paginating internally like {@link getAllBuckets}. */
    async getAllObjects(bucketKey: string): Promise<ObjectDetails[]> {
        const items: ObjectDetails[] = [];
        let startAt: string | undefined;
        let next: string | undefined;
        do {
            const page = await this.client.getObjects(bucketKey, { startAt });
            items.push(...(page.items ?? []));
            next = page.next;
            startAt = nextStartAt(next);
        } while (next);
        return items;
    }

    createBucket(region: string, bucketKey: string, policyKey: string): Promise<Bucket> {
        return this.client.createBucket(region as Region, { bucketKey, policyKey: policyKey as PolicyKey });
    }

    getBucketDetails(bucketKey: string): Promise<Bucket> {
        return this.client.getBucketDetails(bucketKey);
    }

    async deleteBucket(bucketKey: string): Promise<void> {
        await this.client.deleteBucket(bucketKey);
    }

    getObjectDetails(bucketKey: string, objectKey: string): Promise<ObjectFullDetails> {
        return this.client.getObjectDetails(bucketKey, objectKey);
    }

    uploadObject(bucketKey: string, objectKey: string, filePath: string, options?: IUploadObjectOptions): Promise<ObjectDetails> {
        return this.client.uploadObject(bucketKey, objectKey, filePath, {
            xAdsMetaContentType: options?.contentType,
            onProgress: options?.onProgress
        });
    }

    /**
     * Creates an empty object by requesting a write-access signed URL and uploading a zero-byte body
     * to it. Returns the new object's ID.
     */
    async createEmptyObject(bucketKey: string, objectKey: string): Promise<string> {
        const signedUrl = await this.client.createSignedResource(bucketKey, objectKey, { access: Access.Write });
        const response = await fetch(signedUrl.signedUrl, { method: 'PUT', body: new Uint8Array(0) });
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
        const data = await response.json();
        return data.objectId;
    }

    async copyObject(bucketKey: string, objectKey: string, newObjectKey: string): Promise<void> {
        await this.client.copyTo(bucketKey, objectKey, newObjectKey);
    }

    /** Renames an object by copying it to the new key and deleting the original (OSS has no rename op). */
    async renameObject(bucketKey: string, objectKey: string, newObjectKey: string): Promise<void> {
        await this.client.copyTo(bucketKey, objectKey, newObjectKey);
        await this.client.deleteObject(bucketKey, objectKey);
    }

    downloadObject(bucketKey: string, objectKey: string, filePath: string): Promise<void> {
        return this.client.downloadObject(bucketKey, objectKey, filePath);
    }

    async deleteObject(bucketKey: string, objectKey: string): Promise<void> {
        await this.client.deleteObject(bucketKey, objectKey);
    }

    /** Deletes many objects in parallel batches, with optional progress reporting and cancellation. */
    async deleteObjects(bucketKey: string, objectKeys: string[], options?: IDeleteObjectsOptions): Promise<void> {
        let batch: Promise<unknown>[] = [];
        for (let i = 0, len = objectKeys.length; i < len; i++) {
            if (options?.isCancelled?.()) {
                break;
            }
            batch.push(this.client.deleteObject(bucketKey, objectKeys[i]));
            if (batch.length === DeleteBatchSize || i === len - 1) {
                await Promise.all(batch);
                options?.onProgress?.(100.0 * batch.length / len);
                batch = [];
            }
        }
    }

    createSignedUrl(bucketKey: string, objectKey: string, access: SignedUrlAccess): Promise<CreateObjectSigned> {
        return this.client.createSignedResource(bucketKey, objectKey, { access: SignedUrlAccessMap[access] });
    }
}
