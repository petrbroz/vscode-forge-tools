import * as assert from 'assert';
import { createApsSdkManager } from '../../services/aps-sdk-manager';

describe('createApsSdkManager', () => {
	it('returns undefined when no host is given, so SDK clients fall back to their built-in default', () => {
		assert.strictEqual(createApsSdkManager(undefined), undefined);
		assert.strictEqual(createApsSdkManager(''), undefined);
	});

	it('returns an SdkManager pointed at the given host', () => {
		const manager = createApsSdkManager('https://developer-stg.api.autodesk.com');
		assert.ok(manager);
		assert.strictEqual(manager!.apsConfiguration.baseAddress.toString(), 'https://developer-stg.api.autodesk.com/');
	});
});
