import * as assert from 'assert';
import { WEBHOOKS } from '../../services/webhooks-catalog';

describe('WEBHOOKS catalog', () => {
	it('has unique system ids', () => {
		const ids = WEBHOOKS.map(system => system.id);
		assert.strictEqual(ids.length, new Set(ids).size, `duplicate system ids: ${ids.join(', ')}`);
	});

	it('has non-empty name and events for every system', () => {
		for (const system of WEBHOOKS) {
			assert.ok(system.name, `system "${system.id}" has no name`);
			assert.ok(system.events.length > 0, `system "${system.id}" has no events`);
		}
	});

	it('has unique event ids within each system, and every event has a description and at least one scope', () => {
		for (const system of WEBHOOKS) {
			const eventIds = system.events.map(event => event.id);
			assert.strictEqual(eventIds.length, new Set(eventIds).size, `system "${system.id}" has duplicate event ids: ${eventIds.join(', ')}`);

			for (const event of system.events) {
				assert.ok(event.description, `event "${system.id}/${event.id}" has no description`);
				assert.ok(event.scopes.length > 0, `event "${system.id}/${event.id}" has no scopes`);
			}
		}
	});
});
