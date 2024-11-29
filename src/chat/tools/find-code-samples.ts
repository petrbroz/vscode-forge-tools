import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit(); // Note: anonymous access is heavily rate-limited!
const GITHUB_ORG = 'autodesk-platform-services';

interface IFindCodeSamplesParameters {
	api: 'autodesk-data-management' | 'autodesk-designautomation' | 'autodesk-model-derivative' | 'autodesk-viewer' | 'autodesk-webhooks';
    language: 'nodejs' | 'dotnet';
}

interface IRepository {
    name: string;
    branch: string;
}

/**
 * Tool to find code samples based on specified parameters.
 * Implements the `vscode.LanguageModelTool` interface for `IFindCodeSamplesParameters`.
 */
export class FindCodeSamplesTool implements vscode.LanguageModelTool<IFindCodeSamplesParameters> {
    /**
     * Invokes the tool to search for code samples.
     * 
     * @param options - The invocation options containing input parameters.
     * @param token - The cancellation token.
     * @returns A promise that resolves to a `vscode.LanguageModelToolResult` containing the search results.
     */
    async invoke(options: vscode.LanguageModelToolInvocationOptions<IFindCodeSamplesParameters>, token: vscode.CancellationToken) {
        const params = options.input as IFindCodeSamplesParameters;
        const results: vscode.LanguageModelTextPart[] = [];
        try {
            const repos = await searchReposByTopics(GITHUB_ORG, [params.api, params.language]);
            if (repos.length === 0) {
                return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Could not find any samples`)]);
            }
            const filepaths = await searchFilesByExtension(GITHUB_ORG, repos[0], params.language === 'nodejs' ? '.js' : '.cs');
            for (const filepath of filepaths) {
                const content = await readFileContent(GITHUB_ORG, repos[0], filepath);
                results.push(new vscode.LanguageModelTextPart(`Here is a relevant code sample:\n\n${content}`));
            }
        } catch (err: any) {
            console.error(err);
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error: ${err.message}`)]);
        }
        return new vscode.LanguageModelToolResult(results);
    }

    /**
     * Prepares the invocation message for the tool.
     * 
     * @param options - The preparation options containing input parameters.
     * @param _token - The cancellation token.
     * @returns A promise that resolves to an object containing the invocation message.
     */
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IFindCodeSamplesParameters>, _token: vscode.CancellationToken) {
        return {
            invocationMessage: `Searching for ${options.input.language} code samples using ${options.input.api}...`,
        };
    }
}

/**
 * Searches for repositories within a specified GitHub organization that match the given topics.
 *
 * @param org - The name of the organization to search within.
 * @param topics - An array of topics to filter the repositories by.
 * @returns A promise that resolves to an array of repositories matching the search criteria.
 */
async function searchReposByTopics(org: string, topics: string[]): Promise<IRepository[]> {
    const q = `org:${org} ` + topics.map(topic => `topic:${topic}`).join(' ');
    console.debug(`Searching for repos with query: "${q}"`);
    const response = await octokit.rest.search.repos({ q, sort: 'stars', order: 'desc' });
    console.debug(`Found ${response.data.items.length} repos`);
    return response.data.items.map(repo => ({ name: repo.name, branch: repo.default_branch}));
}

/**
 * Searches for files with a specific extension in a given GitHub repository.
 *
 * @param owner - The owner of the repository.
 * @param repo - The repository object containing the name and branch.
 * @param extension - The file extension to search for.
 * @returns A promise that resolves to an array of file paths with the specified extension.
 */
async function searchFilesByExtension(owner: string, repo: IRepository, extension: string): Promise<string[]> {
    console.debug(`Searching for ${extension} files in ${owner}/${repo.name}`);
    const { data: ref } = await octokit.rest.git.getRef({ owner, repo: repo.name, ref: `heads/${repo.branch}` });
    const { data: { tree } } = await octokit.rest.git.getTree({ owner, repo: repo.name, tree_sha: ref.object.sha, recursive: 'true' });
    console.debug(`Found ${tree.length} files`);
    return tree.filter((file) => file.type === "blob" && file.path?.endsWith(extension)).map(file => file.path!);
}

/**
 * Reads the content of a file from a GitHub repository.
 *
 * @param owner - The owner of the repository.
 * @param repo - The repository object containing the repository name.
 * @param filepath - The path to the file within the repository.
 * @returns A promise that resolves to the content of the file as a string.
 * @throws An error if the file content is not available.
 */
async function readFileContent(owner: string, repo: IRepository, filepath: string): Promise<string> {
    console.debug(`Reading content of ${owner}/${repo.name}/${filepath}`);
    const { data: fileContent } = await octokit.rest.repos.getContent({ owner, repo: repo.name, path: filepath, ref: `heads/${repo.branch}` });
    if ('content' in fileContent) {
        return Buffer.from(fileContent.content, 'base64').toString('utf-8');
    } else {
        throw new Error('File content is not available');
    }
}
