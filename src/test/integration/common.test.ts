import * as assert from 'assert';
import * as vscode from 'vscode';
import { showErrorMessage, promptBucket, promptObject, promptDerivative } from '../../common';

describe('showErrorMessage', () => {
	const originalShowErrorMessage = vscode.window.showErrorMessage;
	const originalOpenTextDocument = vscode.workspace.openTextDocument;
	const originalShowTextDocument = vscode.window.showTextDocument;

	afterEach(() => {
		(vscode.window as any).showErrorMessage = originalShowErrorMessage;
		(vscode.workspace as any).openTextDocument = originalOpenTextDocument;
		(vscode.window as any).showTextDocument = originalShowTextDocument;
	});

	it('appends a string error to the title', async () => {
		let shown: string | undefined;
		(vscode.window as any).showErrorMessage = async (msg: string) => { shown = msg; };

		await showErrorMessage('Could not do the thing', 'network is down');

		assert.strictEqual(shown, 'Could not do the thing: network is down');
	});

	it('appends err.message when err is an Error-shaped object', async () => {
		let shown: string | undefined;
		(vscode.window as any).showErrorMessage = async (msg: string) => { shown = msg; };

		await showErrorMessage('Could not do the thing', new Error('boom'));

		assert.strictEqual(shown, 'Could not do the thing: boom');
	});

	it('falls back to err.detail when there is no message', async () => {
		let shown: string | undefined;
		(vscode.window as any).showErrorMessage = async (msg: string) => { shown = msg; };

		await showErrorMessage('Could not do the thing', { detail: 'disk full' });

		assert.strictEqual(shown, 'Could not do the thing: disk full');
	});

	it('shows just the title when the error has neither message nor detail', async () => {
		let shown: string | undefined;
		(vscode.window as any).showErrorMessage = async (msg: string) => { shown = msg; };

		await showErrorMessage('Could not do the thing', {});

		assert.strictEqual(shown, 'Could not do the thing');
	});

	it('logs the title and the error to context.log when a context is given', async () => {
		(vscode.window as any).showErrorMessage = async () => undefined;
		const logged: any[] = [];
		const fakeContext = { log: { error: (m: any) => logged.push(m) } };

		await showErrorMessage('Could not do the thing', new Error('boom'), fakeContext as any);

		assert.strictEqual(logged.length, 2);
		assert.strictEqual(logged[0], 'Could not do the thing');
		assert.strictEqual(String(logged[1]), 'Error: boom');
	});

	it('offers "Show Details" and opens a JSON document with the response when accepted', async () => {
		let buttons: string[] = [];
		(vscode.window as any).showErrorMessage = async (_msg: string, ...opts: string[]) => { buttons = opts; return 'Show Details'; };
		let openedContent: string | undefined;
		(vscode.workspace as any).openTextDocument = async (options: any) => { openedContent = options.content; return {} as any; };
		(vscode.window as any).showTextDocument = async () => undefined;

		const err = {
			message: 'nope',
			response: { status: 403, statusText: 'Forbidden', data: { message: 'nope' }, headers: { 'content-type': 'text/plain' } }
		};
		await showErrorMessage('Could not do the thing', err);

		assert.deepStrictEqual(buttons, ['Show Details']);
		const parsed = JSON.parse(openedContent!);
		assert.strictEqual(parsed.status, 403);
		assert.deepStrictEqual(parsed.data, { message: 'nope' });
	});

	it('does not open a document when the "Show Details" prompt is dismissed', async () => {
		(vscode.window as any).showErrorMessage = async () => undefined;
		let openTextDocumentCalled = false;
		(vscode.workspace as any).openTextDocument = async () => { openTextDocumentCalled = true; return {} as any; };

		await showErrorMessage('Could not do the thing', { message: 'nope', response: { status: 500 } });

		assert.strictEqual(openTextDocumentCalled, false);
	});
});

describe('promptBucket / promptObject / promptDerivative', () => {
	const originalShowQuickPick = vscode.window.showQuickPick;
	const originalShowWarningMessage = vscode.window.showWarningMessage;

	afterEach(() => {
		(vscode.window as any).showQuickPick = originalShowQuickPick;
		(vscode.window as any).showWarningMessage = originalShowWarningMessage;
	});

	it('promptBucket returns undefined when the user cancels the quick pick', async () => {
		(vscode.window as any).showQuickPick = async () => undefined;
		const fakeContext = { ossService: { getAllBuckets: async () => [{ bucketKey: 'bucket-1' }] } };

		assert.strictEqual(await promptBucket(fakeContext as any), undefined);
	});

	it('promptBucket returns the picked bucket', async () => {
		const buckets = [{ bucketKey: 'bucket-1' }, { bucketKey: 'bucket-2' }];
		(vscode.window as any).showQuickPick = async () => 'bucket-2';
		const fakeContext = { ossService: { getAllBuckets: async () => buckets } };

		assert.strictEqual(await promptBucket(fakeContext as any), buckets[1]);
	});

	it('promptObject returns undefined when the user cancels the quick pick', async () => {
		(vscode.window as any).showQuickPick = async () => undefined;
		const fakeContext = { ossService: { getAllObjects: async () => [{ objectKey: 'a.txt' }] } };

		assert.strictEqual(await promptObject(fakeContext as any, 'bucket-1'), undefined);
	});

	it('promptObject returns the picked object', async () => {
		const objects = [{ objectKey: 'a.txt' }, { objectKey: 'b.txt' }];
		(vscode.window as any).showQuickPick = async () => 'b.txt';
		const fakeContext = { ossService: { getAllObjects: async () => objects } };

		assert.strictEqual(await promptObject(fakeContext as any, 'bucket-1'), objects[1]);
	});

	it('promptDerivative warns and returns undefined when there are no derivatives yet', async () => {
		let warned: string | undefined;
		(vscode.window as any).showWarningMessage = (msg: string) => { warned = msg; return Promise.resolve(undefined); };
		const fakeContext = { modelDerivativeService: { getViewableDerivatives: async () => null } };

		assert.strictEqual(await promptDerivative(fakeContext as any, 'my-bucket/model.rvt'), undefined);
		assert.ok(warned?.includes('No derivatives yet'));
	});

	it('promptDerivative returns undefined when the user cancels the quick pick', async () => {
		(vscode.window as any).showQuickPick = async () => undefined;
		const fakeContext = { modelDerivativeService: { getViewableDerivatives: async () => [{ name: 'View1' }] } };

		assert.strictEqual(await promptDerivative(fakeContext as any, 'my-bucket/model.rvt'), undefined);
	});

	it('promptDerivative returns the picked derivative', async () => {
		const derivatives = [{ name: 'View1' }, { name: 'View2' }];
		(vscode.window as any).showQuickPick = async () => 'View2';
		const fakeContext = { modelDerivativeService: { getViewableDerivatives: async () => derivatives } };

		assert.strictEqual(await promptDerivative(fakeContext as any, 'my-bucket/model.rvt'), derivatives[1]);
	});
});
