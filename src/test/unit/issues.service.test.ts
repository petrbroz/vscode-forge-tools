import * as assert from 'assert';
import { IssuesService } from '../../services/issues';

describe('IssuesService', () => {
	describe('getIssues', () => {
		it('strips the "b." Data Management prefix before calling the Issues API', async () => {
			let receivedContainerId: string | undefined;
			const fakeClient = {
				getIssues: async (containerId: string) => {
					receivedContainerId = containerId;
					return { results: [] };
				}
			};

			const service = new IssuesService(fakeClient as any);
			await service.getIssues('b.my-project-guid');

			assert.strictEqual(receivedContainerId, 'my-project-guid');
		});

		it('leaves a projectId with no "b." prefix untouched', async () => {
			let receivedContainerId: string | undefined;
			const fakeClient = {
				getIssues: async (containerId: string) => {
					receivedContainerId = containerId;
					return { results: [] };
				}
			};

			const service = new IssuesService(fakeClient as any);
			await service.getIssues('my-project-guid');

			assert.strictEqual(receivedContainerId, 'my-project-guid');
		});

		it('maps SDK issues to view models, falling back to placeholders for missing title/status', async () => {
			const fakeClient = {
				getIssues: async () => ({
					results: [
						{ id: 'issue-1', displayId: 1, title: 'Broken thing', status: 'open', assignedTo: 'user-1', dueDate: '2026-01-01' },
						{ id: 'issue-2', displayId: 2, title: '', status: '' }
					]
				})
			};

			const service = new IssuesService(fakeClient as any);
			const issues = await service.getIssues('b.project-1');

			assert.deepStrictEqual(issues, [
				{ kind: 'issue', projectId: 'project-1', id: 'issue-1', displayId: 1, title: 'Broken thing', status: 'open', assignedTo: 'user-1', dueDate: '2026-01-01' },
				{ kind: 'issue', projectId: 'project-1', id: 'issue-2', displayId: 2, title: '<no title>', status: '<no status>', assignedTo: undefined, dueDate: undefined }
			]);
		});

		it('returns an empty array when the SDK response has no results', async () => {
			const fakeClient = { getIssues: async () => ({}) };
			const service = new IssuesService(fakeClient as any);
			assert.deepStrictEqual(await service.getIssues('b.project-1'), []);
		});
	});

	describe('getIssueDetails', () => {
		it('delegates to the client with the (already-stripped) container id', async () => {
			const details = { id: 'issue-1', title: 'Broken thing' };
			let received: any;
			const fakeClient = {
				getIssueDetails: async (projectId: string, issueId: string) => {
					received = { projectId, issueId };
					return details;
				}
			};

			const service = new IssuesService(fakeClient as any);
			const result = await service.getIssueDetails('project-1', 'issue-1');

			assert.strictEqual(result, details);
			assert.deepStrictEqual(received, { projectId: 'project-1', issueId: 'issue-1' });
		});
	});

	describe('getIssueComments', () => {
		it('returns the comments results', async () => {
			const comments = [{ id: 'comment-1', body: 'Looks good' }];
			const fakeClient = { getComments: async () => ({ results: comments }) };

			const service = new IssuesService(fakeClient as any);
			assert.strictEqual(await service.getIssueComments('project-1', 'issue-1'), comments);
		});

		it('returns an empty array when the SDK response has no results', async () => {
			const fakeClient = { getComments: async () => ({}) };
			const service = new IssuesService(fakeClient as any);
			assert.deepStrictEqual(await service.getIssueComments('project-1', 'issue-1'), []);
		});
	});
});
