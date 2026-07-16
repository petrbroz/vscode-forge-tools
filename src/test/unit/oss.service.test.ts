import * as assert from 'assert';
import { OssService } from '../../services/oss';

describe('OssService', () => {
	describe('getAllBuckets', () => {
		it('follows the next -> startAt continuation-token loop across pages', async () => {
			const seenStartAts: (string | undefined)[] = [];
			const fakeClient = {
				getBuckets: async ({ startAt }: { startAt?: string }) => {
					seenStartAts.push(startAt);
					if (startAt === undefined) {
						return { items: [{ bucketKey: 'bucket-1' }], next: 'https://x/api/oss/v2/buckets?startAt=cursor-1' };
					}
					assert.strictEqual(startAt, 'cursor-1');
					return { items: [{ bucketKey: 'bucket-2' }], next: undefined };
				}
			};

			const service = new OssService(fakeClient as any);
			const buckets = await service.getAllBuckets();

			assert.deepStrictEqual(buckets.map(b => b.bucketKey), ['bucket-1', 'bucket-2']);
			assert.deepStrictEqual(seenStartAts, [undefined, 'cursor-1']);
		});
	});

	describe('getAllObjects', () => {
		it('follows the next -> startAt continuation-token loop and tolerates a missing items array', async () => {
			const fakeClient = {
				getObjects: async (bucketKey: string, { startAt }: { startAt?: string }) => {
					assert.strictEqual(bucketKey, 'my-bucket');
					if (startAt === undefined) {
						return { items: [{ objectKey: 'a.txt' }], next: 'https://x/api?startAt=cursor-1' };
					}
					return { items: undefined, next: undefined };
				}
			};

			const service = new OssService(fakeClient as any);
			const objects = await service.getAllObjects('my-bucket');

			assert.deepStrictEqual(objects.map(o => o.objectKey), ['a.txt']);
		});
	});

	describe('deleteObjects', () => {
		it('batches deletions at DeleteBatchSize and reports progress increments', async () => {
			const deleted: string[] = [];
			const fakeClient = {
				deleteObject: async (_bucketKey: string, objectKey: string) => {
					deleted.push(objectKey);
				}
			};
			const objectKeys = Array.from({ length: 10 }, (_, i) => `obj-${i}`);
			const progressIncrements: number[] = [];

			const service = new OssService(fakeClient as any);
			await service.deleteObjects('my-bucket', objectKeys, {
				onProgress: increment => progressIncrements.push(increment)
			});

			assert.deepStrictEqual(deleted, objectKeys);
			// Batch size is 8: first batch of 8 (80%), then a final batch of 2 (20%).
			assert.strictEqual(progressIncrements.length, 2);
			assert.ok(Math.abs(progressIncrements.reduce((a, b) => a + b, 0) - 100) < 1e-9);
		});

		it('stops early when isCancelled returns true', async () => {
			const deleted: string[] = [];
			const fakeClient = {
				deleteObject: async (_bucketKey: string, objectKey: string) => {
					deleted.push(objectKey);
				}
			};
			const objectKeys = Array.from({ length: 10 }, (_, i) => `obj-${i}`);

			const service = new OssService(fakeClient as any);
			await service.deleteObjects('my-bucket', objectKeys, { isCancelled: () => deleted.length >= 3 });

			assert.ok(deleted.length <= 3);
		});
	});

	describe('renameObject', () => {
		it('copies to the new key before deleting the original', async () => {
			const calls: string[] = [];
			const fakeClient = {
				copyTo: async (bucketKey: string, objectKey: string, newObjectKey: string) => {
					calls.push(`copyTo:${bucketKey}/${objectKey}->${newObjectKey}`);
				},
				deleteObject: async (bucketKey: string, objectKey: string) => {
					calls.push(`deleteObject:${bucketKey}/${objectKey}`);
				}
			};

			const service = new OssService(fakeClient as any);
			await service.renameObject('my-bucket', 'old.txt', 'new.txt');

			assert.deepStrictEqual(calls, [
				'copyTo:my-bucket/old.txt->new.txt',
				'deleteObject:my-bucket/old.txt'
			]);
		});
	});

	describe('createEmptyObject', () => {
		const originalFetch = global.fetch;
		afterEach(() => {
			global.fetch = originalFetch;
		});

		it('uploads a zero-byte body to the signed write URL and returns the new object id', async () => {
			let putRequest: { url: string; init: RequestInit } | undefined;
			global.fetch = (async (url: string, init: RequestInit) => {
				putRequest = { url, init };
				return {
					ok: true,
					json: async () => ({ objectId: 'my-bucket/empty.txt' })
				};
			}) as any;

			const fakeClient = {
				createSignedResource: async () => ({ signedUrl: 'https://signed.example/upload' })
			};

			const service = new OssService(fakeClient as any);
			const objectId = await service.createEmptyObject('my-bucket', 'empty.txt');

			assert.strictEqual(objectId, 'my-bucket/empty.txt');
			assert.strictEqual(putRequest?.url, 'https://signed.example/upload');
			assert.strictEqual(putRequest?.init.method, 'PUT');
			assert.strictEqual((putRequest?.init.body as Uint8Array).length, 0);
		});

		it('throws when the upload response is not ok', async () => {
			global.fetch = (async () => ({ ok: false, status: 500 })) as any;
			const fakeClient = {
				createSignedResource: async () => ({ signedUrl: 'https://signed.example/upload' })
			};

			const service = new OssService(fakeClient as any);
			await assert.rejects(() => service.createEmptyObject('my-bucket', 'empty.txt'));
		});
	});
});
