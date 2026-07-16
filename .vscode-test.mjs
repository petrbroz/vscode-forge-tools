import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		label: 'unit',
		files: 'out/test/unit/**/*.test.js',
		mocha: { ui: 'bdd', timeout: 20000 }
	},
	{
		label: 'integration',
		files: 'out/test/integration/**/*.test.js',
		workspaceFolder: 'src/test/fixtures/workspace',
		mocha: { ui: 'bdd', timeout: 60000 }
	}
]);
