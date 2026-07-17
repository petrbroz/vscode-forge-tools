import * as assert from 'assert';
import { urnify } from '../../urn';

describe('urnify', () => {
	it('base64-encodes an object id', () => {
		const id = 'my-bucket/model.rvt';
		assert.strictEqual(urnify(id), Buffer.from(id).toString('base64'));
	});

	it('uses the plain base64 alphabet, not the url-safe one (keeps "/", does not swap it for "_")', () => {
		// This id's utf8 bytes happen to base64-encode with a "/" in the output - if urnify used the
		// url-safe alphabet (like the model-derivative service's separate urlSafeUrn helper does), it
		// would come out as "_" instead.
		const id = Buffer.from([0xff, 0xff, 0xff]).toString('latin1');
		assert.strictEqual(urnify(id), Buffer.from(id).toString('base64'));
		assert.ok(urnify(id).includes('/'));
	});

	it('round-trips back to the original id when base64-decoded', () => {
		const id = 'urn:adsk.objects:os.object:my-bucket/model.rvt';
		assert.strictEqual(Buffer.from(urnify(id), 'base64').toString(), id);
	});
});
