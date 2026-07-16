import * as assert from 'assert';
import * as vscode from 'vscode';

describe('extension activation', () => {
	it('activates and registers commands without throwing', async () => {
		const ext = vscode.extensions.getExtension('petrbroz.vscode-forge-tools');
		assert.ok(ext, 'extension not found');

		await ext!.activate();

		assert.strictEqual(ext!.isActive, true);
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('aps.oss.refreshBuckets'));
		assert.ok(commands.includes('aps.wh.refreshWebhooks'));
		assert.ok(commands.includes('aps.da.refreshDesignAutomationTree'));
		assert.ok(commands.includes('aps.ssa.refreshAccounts'));
	});
});
