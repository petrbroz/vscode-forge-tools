import * as assert from 'assert';
import { stringPropertySorter } from '../../common';

describe('stringPropertySorter', () => {
	it('sorts ascending by the given string property', () => {
		const items = [{ name: 'banana' }, { name: 'apple' }, { name: 'cherry' }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('name')).map(i => i.name), ['apple', 'banana', 'cherry']);
	});

	it('treats equal values as equal (stable, no reordering forced)', () => {
		const items = [{ name: 'apple', id: 1 }, { name: 'apple', id: 2 }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('name')).map(i => i.id), [1, 2]);
	});

	it('works with a numeric property too (relies on < and >)', () => {
		const items = [{ size: 30 }, { size: 10 }, { size: 20 }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('size')).map(i => i.size), [10, 20, 30]);
	});
});
