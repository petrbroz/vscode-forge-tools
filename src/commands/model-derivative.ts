import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Scopes } from '@aps_sdk/authentication';
import { ObjectDetails } from '@aps_sdk/oss';
import {
	ModelDerivativeClient,
	ObjectTree,
	Properties,
	JobPayload
} from '@aps_sdk/model-derivative';
import { urnify as _urnify } from '../urn';
import { IContext, promptBucket, promptObject, promptDerivative, showErrorMessage, inHubs, promptCustomDerivative } from '../common';
import { IDerivative } from '../interfaces/model-derivative';
import { withProgress, createWebViewPanel, createViewerWebViewPanel } from '../common';
import { ICustomDerivativeMessage, ICustomDerivativeProps } from '../webviews/custom-translation';
import { ModelDerivativeFormats, svf2 } from '../providers/model-derivative';
import { IVersion } from '../interfaces/hubs';

export class ModelDerivativesCommands {
	constructor(protected context: IContext, protected refresh: () => void) {
	}

	registerCommands(): vscode.Disposable[] {
		return [
			vscode.commands.registerCommand('aps.md.translateObject', this.translateObject.bind(this)),
			vscode.commands.registerCommand('aps.md.translateObjectCustom', this.translateObjectCustom.bind(this)),
			vscode.commands.registerCommand('aps.md.listViewables', this.listViewables.bind(this)),
			vscode.commands.registerCommand('aps.md.previewDerivative', this.previewDerivative.bind(this)),
			vscode.commands.registerCommand('aps.md.viewDerivativeTree', this.viewDerivativeTree.bind(this)),
			vscode.commands.registerCommand('aps.md.viewDerivativeProps', this.viewDerivativeProps.bind(this)),
			vscode.commands.registerCommand('aps.md.viewObjectManifest', this.viewObjectManifest.bind(this)),
			vscode.commands.registerCommand('aps.md.viewObjectThumbnail', this.viewObjectThumbnail.bind(this)),
			vscode.commands.registerCommand('aps.md.deleteObjectManifest', this.deleteObjectManifest.bind(this)),
			vscode.commands.registerCommand('aps.md.downloadDerivativeCustom', this.downloadDerivativeCustom.bind(this)),
			vscode.commands.registerCommand('aps.md.copyObjectUrn', this.copyObjectUrn.bind(this)),
		];
	}

	async translateObject(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			const formats = await getModelDerivativeFormats(this.context);

			const extension = getFileExtension(object);

			const availableFormats = formats.findAvailableOutputFormats(extension);

			if (!availableFormats.find(x => x === svf2)) {
				showErrorMessage("The conversion to SVF2 is not supported for this file by Model derivative service", {});
				return;
			}

			let urn = getURN(object);
			let client = getModelDerivativeClientForObject(object, this.context);
			client.startJob({ input: { urn }, output: { formats: [{ type: svf2, views: ['2d', '3d'] }] as any } }, { xAdsForce: true });
			vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
		} catch (err) {
			showErrorMessage('Could not translate object', err, this.context);
		}
		this.refresh();
	}

	async translateObjectCustom(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			let urn = getURN(object);
			let client = getModelDerivativeClientForObject(object, this.context);

			const formats = await getModelDerivativeFormats(this.context);

			const extension = getFileExtension(object);

			const availableFormats = formats.findAvailableOutputFormats(extension);

			if (availableFormats.length === 0) {
				showErrorMessage("Source file format is not supported by Model derivative service", {});
				return;
			}

			let panel = createWebViewPanel<ICustomDerivativeProps>(this.context, 'custom-translation.js', 'custom-translation', `Custom Translation: ${urn}`, { urn, availableFormats }, async (message: ICustomDerivativeMessage) => {
				switch (message.type) {
					case 'translate':
						const {
							outputFormat,
							rootFilename,
							switchLoader,
							generateMasterViews,
							workflowId,
							workflowAttributes
						} = message.data;
						// TODO: support additional flags in the output format payload
						const outputOptions = {
							type: outputFormat,
							views: ['2d', '3d'],
							advanced: {
								switchLoader,
								generateMasterViews
							}
						} as any;
						try {
							const jobPayload: JobPayload = {
								input: { urn, compressedUrn: !!rootFilename, rootFilename },
								output: { formats: [outputOptions] },
								misc: workflowId ? { workflow: workflowId, workflowAttribute: workflowAttributes ? JSON.parse(workflowAttributes) : undefined } : undefined
							};
							await client.startJob(jobPayload, { xAdsForce: true });
							vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
						} catch (err: any) {
							if (err.response && err.response.statusCode === 406) {
								showErrorMessage('Could not translate object, likely because its derivatives exist in a different region. Please, delete the derivatives manually before translating the object again.', null);
							} else {
								showErrorMessage('Could not translate object', err, this.context);
							}
						}
						panel.dispose();
						this.refresh();
						break;
				}
			});
		} catch (err) {
			showErrorMessage('Could not translate object', err, this.context);
		}
	}

	async listViewables(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}
			const urn = getURN(object);
			const client = getModelDerivativeClientForObject(object, this.context);
			const metadata = await withProgress(`Retrieving list of viewables`, client.getModelViews(urn));
			const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(metadata, null, 4), language: 'json' });
			await vscode.window.showTextDocument(doc, { preview: false });
		} catch (err) {
			showErrorMessage('Could not retrieve viewables', err, this.context);
		}
	}

	async previewDerivative(derivative?: IDerivative) {
		try {
			if (!derivative) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
				derivative = await promptDerivative(this.context, object.objectId!);
				if (!derivative) {
					return;
				}
			}
			const token = inHubs(derivative.urn) && this.context.threeLeggedToken
				? { access_token: this.context.threeLeggedToken }
				: await this.context.authenticationClient.getTwoLeggedToken(this.context.clientId, this.context.clientSecret, [Scopes.ViewablesRead]);
			let env = this.context.previewSettings.env;
			if (!env) {
				env = derivative.format === svf2 ? 'AutodeskProduction2' : 'AutodeskProduction';
			}
			let api = this.context.previewSettings.api;
			if (!api) {
				api = derivative.format === svf2 ? 'streamingV2' : 'derivativeV2';
				if (this.context.environment.region === 'EMEA') {
					api += '_EU';
				}
				// TODO: what about 'APAC'?
			}
			createViewerWebViewPanel(this.context, 'derivative-preview.js', 'derivative-preview', `Preview: ${derivative.name}`, {
				api, env,
				token: token.access_token,
				urn: derivative.urn,
				guid: derivative.guid,
				config: {
					extensions: this.context.previewSettings.extensions
				}
			}, message => {
				switch (message.type) {
					case 'error':
						showErrorMessage(`Could not load viewable`, message.error, this.context);
						break;
				}
			});
		} catch (err) {
			showErrorMessage(`Could not access object`, err, this.context);
		}
	}

	async viewDerivativeTree(derivative?: IDerivative) {
		try {
			if (!derivative) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
				derivative = await promptDerivative(this.context, object.objectId!);
				if (!derivative) {
					return;
				}
			}
			const viewable = findViewable(derivative);
			const { urn } = derivative;
			const { guid } = viewable;
			const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
			let forceDownload = false;
			let tree: ObjectTree | undefined = undefined;
			try {
				tree = await withProgress(`Retrieving viewable tree`, client.getObjectTree(urn, guid));
			} catch (err: any) {
				// APS may respond with code 413 to indicate that the requested JSON data is too large.
				// In that case, offer an option of downloading the content to a local file.
				if (err.isAxiosError && err.response.status === 413) {
					const action = await vscode.window.showInformationMessage(`
						Cannot obtain viewable tree, possibly because the content is too large.
						Would you like to try and force-download the tree JSON?
					`, 'Force Download', 'Cancel');
					switch (action) {
						case 'Force Download':
							// TODO: redirect the downloaded data directly into a file stream
							tree = await withProgress(`Downloading viewable tree`, client.getObjectTree(urn, guid, { forceget: 'true' }));
							forceDownload = true;
							break;
						case 'Cancel':
							break;
					}
				} else {
					throw err;
				}
			}
			if (forceDownload) {
				const defaultPath = vscode.workspace.asRelativePath('tree.json');
				const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath) });
				if (uri) {
					fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
					fs.writeFileSync(uri.fsPath, JSON.stringify(tree, null, 4));
					const action = await vscode.window.showInformationMessage(`Tree downloaded to ${uri.fsPath}.`, 'Open Folder');
					if (action === 'Open Folder') {
						vscode.env.openExternal(vscode.Uri.file(path.dirname(uri.fsPath)));
					}
				}
			} else {
				const content = JSON.stringify(tree, null, 4);
				const doc = await vscode.workspace.openTextDocument({ content, language: 'json' });
				await vscode.window.showTextDocument(doc, { preview: false });
			}
		} catch (err) {
			showErrorMessage('Could not access derivative tree', err, this.context);
		}
	}

	async viewDerivativeProps(derivative?: IDerivative) {
		try {
			if (!derivative) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
				derivative = await promptDerivative(this.context, object.objectId!);
				if (!derivative) {
					return;
				}
			}
			const viewable = findViewable(derivative);
			const { urn } = derivative;
			const { guid } = viewable;
			const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
			let forceDownload = false;
			let props: Properties | undefined = undefined;
			try {
				props = await withProgress(`Retrieving viewable properties`, client.getAllProperties(urn, guid));
			} catch (err: any) {
				// APS may respond with code 413 to indicate that the requested JSON data is too large.
				// In that case, offer an option of downloading the content to a local file.
				if (err.isAxiosError && err.response.status === 413) {
					const action = await vscode.window.showInformationMessage(`
						Cannot obtain viewable properties, possibly because the content is too large.
						Would you like to try and force-download the property JSON?
					`, 'Force Download', 'Cancel');
					switch (action) {
						case 'Force Download':
							// TODO: redirect the downloaded data directly into a file stream
							props = await withProgress(`Downloading viewable properties`, client.getAllProperties(urn, guid, { forceget: 'true' }));
							forceDownload = true;
							break;
						case 'Cancel':
							break;
					}
				} else {
					throw err;
				}
			}
			if (forceDownload) {
				const defaultPath = vscode.workspace.asRelativePath('properties.json');
				const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath) });
				if (uri) {
					fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
					fs.writeFileSync(uri.fsPath, JSON.stringify(props, null, 4));
					const action = await vscode.window.showInformationMessage(`Properties downloaded to ${uri.fsPath}.`, 'Open Folder');
					if (action === 'Open Folder') {
						vscode.env.openExternal(vscode.Uri.file(path.dirname(uri.fsPath)));
					}
				}
			} else {
				const content = JSON.stringify(props, null, 4);
				const doc = await vscode.workspace.openTextDocument({ content, language: 'json' });
				await vscode.window.showTextDocument(doc, { preview: false });
			}
		} catch (err) {
			showErrorMessage('Could not access derivative properties', err, this.context);
		}
	}

	async viewObjectManifest(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			let urn = getURN(object);
			let client = getModelDerivativeClientForObject(object, this.context);

			const manifest = await withProgress(`Retrieving manifest for ${urn}`, client.getManifest(urn));
			const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(manifest, null, 4), language: 'json' });
			await vscode.window.showTextDocument(doc, { preview: false });
		} catch (err) {
			showErrorMessage('Could not access object manifest', err, this.context);
		}
	}

	async viewObjectThumbnail(object?: ObjectDetails | IVersion) {
		async function downloadThumbnail(png: string, defaultUri: vscode.Uri) {
			const uri = await vscode.window.showSaveDialog({ defaultUri });
			if (!uri) {
				return;
			}
			fs.writeFileSync(uri.fsPath, Buffer.from(png, 'binary'), { encoding: 'binary' });
			vscode.window.showInformationMessage(`Thumbnail downloaded: ${uri.fsPath}`);
		}

		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			let urn = getURN(object);
			let key = getKey(object);
			let id = getId(object);
			let client = getModelDerivativeClientForObject(object, this.context);

			try {
				const thumbnails = await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Downloading thumbnails: ${key}`,
					cancellable: false
				}, async (progress, token) => {
					await client.getManifest(urn); // Check if the manifest exists
					return await Promise.all([
						client.getThumbnail(urn, { width: 100, height: 100 }),
						client.getThumbnail(urn, { width: 200, height: 200 }),
						client.getThumbnail(urn, { width: 400, height: 400 })
					]);
				});
				const pngToDataURI = (img: string) => 'data:image/png;base64,' + Buffer.from(img, 'binary').toString('base64');
				createWebViewPanel(this.context, 'thumbnails.js', 'thumbnails', `Thumbnails: ${key}`, {
					objectKey: key,
					smallDataURI: pngToDataURI(thumbnails[0]),
					mediumDataURI: pngToDataURI(thumbnails[1]),
					largeDataURI: pngToDataURI(thumbnails[2])
				}, (message: any) => {
					switch (message.command) {
						case 'download':
							switch (message.thumbnailSize) {
								case 'small':
									downloadThumbnail(thumbnails[0], vscode.Uri.file(key + '.100x100.png'));
									break;
								case 'medium':
									downloadThumbnail(thumbnails[1], vscode.Uri.file(key + '.200x200.png'));
									break;
								case 'large':
									downloadThumbnail(thumbnails[2], vscode.Uri.file(key + '.400x400.png'));
									break;
							}
					}
				});
			} catch (_) {
				const action = await vscode.window.showInformationMessage(`
					In order to access the thumbnails of ${id}, the object must be translated first.
					Would you like to start the translation now?
				`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
				switch (action) {
					case TranslationActions.Translate:
						await this.translateObject(object);
						break;
					case TranslationActions.TranslateAsArchive:
						await this.translateObject(object);
						break;
				}
			}
		} catch (err) {
			showErrorMessage('Could not access derivative thumbnails', err, this.context);
		}
	}

	async deleteObjectManifest(object?: ObjectDetails) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			const urn = urnify(object.objectId!);

			const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete manifest for ${urn}? This action cannot be undone.`, { modal: true }, 'Delete');
			if (confirm !== 'Delete') {
				return;
			}

			const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
			try {
				await withProgress(`Deleting manifest for ${urn}`, client.deleteManifest(urn));
			} catch (_) {
				const action = await vscode.window.showInformationMessage(`
					In order to access the manifest of ${object.objectId}, the object must be translated first.
					Would you like to start the translation now?
				`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
				switch (action) {
					case TranslationActions.Translate:
						await this.translateObject(object);
						break;
					case TranslationActions.TranslateAsArchive:
						await this.translateObject(object);
						break;
				}
			}
			vscode.window.showInformationMessage(`Derivatives deleted: ${object.objectKey}`);
		} catch (err) {
			showErrorMessage('Could not delete derivatives', err, this.context);
		}
		this.refresh();
	}

	async downloadDerivativeCustom(object?: IDerivative) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const bucketObject = await promptObject(this.context, bucket.bucketKey);
				if (!bucketObject) {
					return;
				}

				const formats = await getModelDerivativeFormats(this.context);

				object = await promptCustomDerivative(this.context, bucketObject.objectId!, formats);

				if (!object) {
					return;
				}
			}

			const outputFolderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
			if (!outputFolderUri) {
				return;
			}

			const baseDir = outputFolderUri[0].fsPath;
			const targetFileName = path.join(baseDir, object.name);

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading the derivative: ${object.name}`,
				cancellable: false
			}, async () => {
				fs.mkdirSync(baseDir, { recursive: true });
				const derivativeDownload = await this.context.modelDerivativeClient2L.getDerivativeUrl(encodeURI(object!.bubble.fileUrn), object!.urn);
				const response = await fetch(derivativeDownload.url!);
				if (!response.ok) {
					throw new Error(`Request failed with status code ${response.status}`);
				}
				await fs.promises.writeFile(targetFileName, new Uint8Array(await response.arrayBuffer()));
			});

			const action = await vscode.window.showInformationMessage('Derivative downloaded successfully', 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not download the derivative`, err, this.context);
		}
	}

	async copyObjectUrn(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			let urn = getURN(object);
			await vscode.env.clipboard.writeText(urn);
			vscode.window.showInformationMessage(`Object URN copied to clipboard: ${urn}`);
		} catch (err) {
			showErrorMessage('Could not obtain object URN', err, this.context);
		}
	}
}

enum TranslationActions {
	Translate = 'Translate',
	TranslateAsArchive = 'Translate as Archive'
}

function urnify(id: string): string {
	return _urnify(id).replace('/', '_');
}

function getKey(object: ObjectDetails | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectKey!;
	} else if ('itemId' in object) { //IVersion
		return object.itemId;
	}
	return '';
}

function getId(object: ObjectDetails | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectId!;
	} else if ('itemId' in object) { //IVersion
		return object.id;
	}
	return '';
}

function getURN(object: ObjectDetails | IVersion): string {
	return urnify(getId(object));
}

function getFileExtension(object: ObjectDetails | IVersion): string {
	if ("objectKey" in object) {
		return path.extname(object.objectKey!).substring(1).toLowerCase();
	}
	return "";
}

function getModelDerivativeClientForObject(object: ObjectDetails | IVersion, context: IContext): ModelDerivativeClient {
	if ('objectId' in object) { //IObject
		return context.modelDerivativeClient2L;
	} else if ('itemId' in object) { //IVersion
		const client = context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
		return client;
	}
	return context.modelDerivativeClient2L;
}

function findViewable(derivative: IDerivative): any {
	return derivative.bubble.children.find((child: any) => child.role === 'graphics' || child.role === 'pdf-page');
}

let modelDerivativeFormats: ModelDerivativeFormats | null = null;

async function getModelDerivativeFormats(context: IContext) {
	if (modelDerivativeFormats === null)
		modelDerivativeFormats = await ModelDerivativeFormats.create(context);

	return modelDerivativeFormats;
}
