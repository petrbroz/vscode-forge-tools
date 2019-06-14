declare module 'forge-nodejs-utils' {
    interface IAccessToken {
        access_token: string;
        expires_in: number;
    }

    class AuthenticationClient {
        constructor(client_id: string, client_secret: string);
        authenticate(scopes: string[]): Promise<IAccessToken>;
    }

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

    interface IJobOutput {
        type: 'svf',
        views: string[];
    }

    interface IJob {}

    interface IManifest {
        status: string;
        progress: string;
    }

    class ModelDerivativeClient {
        constructor(auth: IAuthOptions);
        submitJob(urn: string, outputs: IJobOutput[]): Promise<IJob>;
        getManifest(urn: string): Promise<IManifest>;
    }
}