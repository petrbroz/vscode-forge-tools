import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit(); // Using anonymous access which is rate-limited

interface IFindCodeSamplesParameters {
	api: 'autodesk-data-management' | 'autodesk-designautomation' | 'autodesk-model-derivative' | 'autodesk-viewer' | 'autodesk-webhooks';
    language: 'nodejs' | 'dotnet';
}

interface IRepository {
    name: string;
    branch: string;
}

export class FindCodeSamplesTool implements vscode.LanguageModelTool<IFindCodeSamplesParameters> {
	async invoke(options: vscode.LanguageModelToolInvocationOptions<IFindCodeSamplesParameters>, token: vscode.CancellationToken) {
        const params = options.input as IFindCodeSamplesParameters;
        const results: vscode.LanguageModelTextPart[] = [];
        const org = 'autodesk-platform-services';
        try {
            const repos = await searchReposByTopics(org, [params.api, params.language]);
            if (repos.length === 0) {
                return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Could not find any samples`)]);
            }
            const filepaths = await searchFilesByExtension(org, repos[0], params.language === 'nodejs' ? '.js' : '.cs');
            for (const filepath of filepaths) {
                const content = await readFileContent(org, repos[0], filepath);
                results.push(new vscode.LanguageModelTextPart(`Here is a relevant code sample:\n\n${content}`));
            }
        } catch (err: any) {
            console.error(err);
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error: ${err.message}`)]);
        }
        return new vscode.LanguageModelToolResult(results);
	}

	async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IFindCodeSamplesParameters>, _token: vscode.CancellationToken) {
		return {
			invocationMessage: `Searching for ${options.input.language} code samples using ${options.input.api}...`,
		};
	}
}

async function searchReposByTopics(org: string, topics: string[]): Promise<IRepository[]> {
    const q = `org:${org} ` + topics.map(topic => `topic:${topic}`).join(' ');
    console.debug(`Searching for repos with query: ${q}`);
    const response = await octokit.rest.search.repos({ q, sort: 'stars', order: 'desc' });
    console.debug(`Found ${response.data.items.length} repos`);
    return response.data.items.map(repo => ({ name: repo.name, branch: repo.default_branch}));
}

async function searchFilesByExtension(owner: string, repo: IRepository, extension: string): Promise<string[]> {
    console.debug(`Searching for ${extension} files in ${owner}/${repo}`);
    const { data: ref } = await octokit.rest.git.getRef({ owner, repo: repo.name, ref: `heads/${repo.branch}` });
    const { data: { tree } } = await octokit.rest.git.getTree({ owner, repo: repo.name, tree_sha: ref.object.sha, recursive: 'true' });
    console.debug(`Found ${tree.length} files`);
    return tree.filter((file) => file.type === "blob" && file.path?.endsWith(extension)).map(file => file.path!);
}

async function readFileContent(owner: string, repo: IRepository, filepath: string): Promise<string> {
    console.debug(`Reading content of ${owner}/${repo}/${filepath}`);
    const { data: fileContent } = await octokit.rest.repos.getContent({ owner, repo: repo.name, path: filepath });
    console.debug(`File content found`);
    if ('content' in fileContent) {
        return Buffer.from(fileContent.content, 'base64').toString('utf-8');
    } else {
        throw new Error('File content is not available');
    }
}
