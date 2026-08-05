import * as assert from 'assert';
import { pickDefaultEnvironment, LAST_ENVIRONMENT_KEY } from '../../environment';
import { IEnvironment } from '../../models/environment';

/** A minimal `vscode.Memento` stand-in, without pulling in the `vscode` module. */
function fakeMemento(initial: Record<string, any> = {}) {
	const store: Record<string, any> = { ...initial };
	return {
		get: (key: string, defaultValue?: any) => (key in store ? store[key] : defaultValue),
		update: async (key: string, value: any) => { store[key] = value; },
		keys: () => Object.keys(store)
	} as any;
}

describe('pickDefaultEnvironment', () => {
	const environments: IEnvironment[] = [
		{ title: 'Staging', clientId: 'id-1', clientSecret: 'secret-1', region: 'US' },
		{ title: 'Production', clientId: 'id-2', clientSecret: 'secret-2', region: 'EMEA' }
	];

	it('returns the first environment when nothing was remembered for this workspace', () => {
		assert.strictEqual(pickDefaultEnvironment(environments, fakeMemento()), environments[0]);
	});

	it('returns the environment remembered for this workspace', () => {
		const workspaceState = fakeMemento({ [LAST_ENVIRONMENT_KEY]: 'Production' });
		assert.strictEqual(pickDefaultEnvironment(environments, workspaceState), environments[1]);
	});

	it('falls back to the first environment when the remembered one no longer exists', () => {
		const workspaceState = fakeMemento({ [LAST_ENVIRONMENT_KEY]: 'Retired Env' });
		assert.strictEqual(pickDefaultEnvironment(environments, workspaceState), environments[0]);
	});
});
