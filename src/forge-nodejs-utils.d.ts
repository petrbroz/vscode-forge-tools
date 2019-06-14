declare module 'forge-nodejs-utils' {
    interface IAuthOptions {
        client_id: string;
        client_secret: string;
    }

    interface IBucket {
        bucketKey: string;
        createdDate: number;
        policyKey: string;
    }

    interface IBucketPermission {
        authId: string;
        access: string;
    }

    interface IBucketDetail extends IBucket {
        bucketOwner: string;
        permissions: IBucketPermission[];
    }

    interface IObject {
        objectKey: string;
        bucketKey: string;
        objectId: string;
        sha1: string;
        size: number;
        location: string;
    }

    class DataManagementClient {
        constructor(auth: IAuthOptions);
        createBucket(name: string, dataRetention: string): Promise<IBucketDetail>;
        listBuckets(): Promise<IBucket[]>;
        listObjects(bucketKey: string): Promise<IObject[]>;
        uploadObject(bucketKey: string, objectKey: string, contentType: string, data: Buffer): Promise<IObject>;
        downloadObject(bucketKey: string, objectKey: string): Promise<Buffer>;
    }
}