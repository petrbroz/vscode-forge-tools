import * as assert from 'assert';
import { DesignAutomationID } from '../../../models/design-automation-api';

describe('DesignAutomationID', () => {
	describe('parse', () => {
		it('parses a fully-qualified owner.id+alias string', () => {
			const id = DesignAutomationID.parse('nick1.MyBundle+prod');
			assert.ok(id);
			assert.strictEqual(id!.owner, 'nick1');
			assert.strictEqual(id!.id, 'MyBundle');
			assert.strictEqual(id!.alias, 'prod');
		});

		it('returns null for a string missing the "." separator', () => {
			assert.strictEqual(DesignAutomationID.parse('nick1MyBundle+prod'), null);
		});

		it('returns null for a string missing the "+" separator', () => {
			assert.strictEqual(DesignAutomationID.parse('nick1.MyBundleprod'), null);
		});
	});

	describe('toString', () => {
		it('round-trips a parsed ID back to its original string form', () => {
			const original = 'nick1.MyBundle+prod';
			assert.strictEqual(DesignAutomationID.parse(original)!.toString(), original);
		});
	});
});
