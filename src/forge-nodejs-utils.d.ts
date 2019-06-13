declare module 'forge-nodejs-utils' {
    interface AuthOptions {
        client_id: string;
        client_secret: string;
    }

    interface Bucket {
        bucketKey: string;
        createdDate: number;
        policyKey: string;
    }

    interface Object {
        objectKey: string;
        bucketKey: string;
        objectId: string;
    }

    class DataManagementClient {
        constructor(auth: AuthOptions);
        listBuckets(): Promise<Bucket[]>;
        listObjects(bucketKey: string): Promise<Object[]>;
    }
}