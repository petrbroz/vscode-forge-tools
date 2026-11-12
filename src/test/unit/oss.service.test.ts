import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

	describe('uploadObject', () => {
		const originalFetch = global.fetch;
		let tmpDir: string;
		beforeEach(() => {
			tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-upload-'));
		});
		afterEach(() => {
			global.fetch = originalFetch;
			fs.rmSync(tmpDir, { recursive: true, force: true });
		});

		it('streams the file in 5 MiB parts and completes the upload', async () => {
			const chunkSize = 5 * 1024 * 1024;
			const content = Buffer.alloc(2 * chunkSize + 123);
			for (let i = 0; i < content.length; i++) {
				content[i] = i % 251;
			}
			const filePath = path.join(tmpDir, 'big.bin');
			fs.writeFileSync(filePath, content);

			const signedRequests: any[] = [];
			const uploaded: Buffer[] = [];
			let completeArgs: any[] | undefined;
			global.fetch = (async (url: string, init: RequestInit) => {
				assert.strictEqual(init.method, 'PUT');
				assert.strictEqual(url, `https://s3.example/part-${uploaded.length + 1}`);
				uploaded.push(Buffer.from(init.body as Uint8Array));
				return { ok: true, status: 200 };
			}) as any;
			const fakeClient = {
				signedS3Upload: async (_bucketKey: string, _objectKey: string, args: any) => {
					signedRequests.push(args);
					const urls = Array.from({ length: args.parts }, (_, i) => `https://s3.example/part-${args.firstPart + i}`);
					return { uploadKey: 'upload-key', urls };
				},
				completeSignedS3Upload: async (...args: any[]) => {
					completeArgs = args;
					return { content: { objectKey: 'big.bin', size: content.length } };
				}
			};
			const progress: number[] = [];

			const service = new OssService(fakeClient as any);
			const result = await service.uploadObject('my-bucket', 'big.bin', filePath, { contentType: 'application/octet-stream', onProgress: p => progress.push(p) });

			assert.deepStrictEqual(result, { objectKey: 'big.bin', size: content.length });
			assert.deepStrictEqual(uploaded.map(b => b.length), [chunkSize, chunkSize, 123]);
			assert.ok(Buffer.concat(uploaded).equals(content));
			assert.strictEqual(signedRequests.length, 1);
			assert.strictEqual(signedRequests[0].parts, 3);
			assert.strictEqual(signedRequests[0].firstPart, 1);
			assert.deepStrictEqual(completeArgs?.slice(0, 4), ['my-bucket', 'big.bin', 'application/json', { uploadKey: 'upload-key' }]);
			assert.strictEqual(completeArgs?.[4].xAdsMetaContentType, 'application/octet-stream');
			assert.strictEqual(progress[progress.length - 1], 100);
		});

		it('requests new signed URLs when a part upload returns 403', async () => {
			const filePath = path.join(tmpDir, 'small.txt');
			fs.writeFileSync(filePath, 'hello');

			const signedRequests: any[] = [];
			let puts = 0;
			global.fetch = (async () => {
				puts++;
				return puts === 1 ? { ok: false, status: 403 } : { ok: true, status: 200 };
			}) as any;
			const fakeClient = {
				signedS3Upload: async (_bucketKey: string, _objectKey: string, args: any) => {
					signedRequests.push(args);
					return { uploadKey: 'upload-key', urls: [`https://s3.example/${signedRequests.length}`] };
				},
				completeSignedS3Upload: async () => ({ content: { objectKey: 'small.txt' } })
			};

			const service = new OssService(fakeClient as any);
			await service.uploadObject('my-bucket', 'small.txt', filePath);

			assert.strictEqual(puts, 2);
			assert.strictEqual(signedRequests.length, 2);
			assert.strictEqual(signedRequests[1].uploadKey, 'upload-key');
		});

		it('uploads an empty file as a single empty part', async () => {
			const filePath = path.join(tmpDir, 'empty.txt');
			fs.writeFileSync(filePath, '');

			const bodies: Uint8Array[] = [];
			global.fetch = (async (_url: string, init: RequestInit) => {
				bodies.push(init.body as Uint8Array);
				return { ok: true, status: 200 };
			}) as any;
			const fakeClient = {
				signedS3Upload: async () => ({ uploadKey: 'upload-key', urls: ['https://s3.example/1'] }),
				completeSignedS3Upload: async () => ({ content: { objectKey: 'empty.txt' } })
			};

			const service = new OssService(fakeClient as any);
			await service.uploadObject('my-bucket', 'empty.txt', filePath);

			assert.deepStrictEqual(bodies.map(b => b.length), [0]);
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
