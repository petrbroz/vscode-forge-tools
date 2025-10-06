import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import {
	IObject,
	urnify as _urnify, // TODO: add '/' to '_' mapping
	ThumbnailSize,
	ManifestHelper,
	IDerivativeResourceChild,
	IDerivativeOutputType,
	IDerivativeProps,
	IDerivativeTree,
	ModelDerivativeClient
} from 'aps-sdk-node';
import { SvfReader, GltfWriter, SvfDownloader, F2dDownloader, TwoLeggedAuthenticationProvider } from 'svf-utils';
import { IContext, promptBucket, promptObject, promptDerivative, showErrorMessage, inHubs, promptCustomDerivative } from '../common';
import { IDerivative } from '../interfaces/model-derivative';
import { withProgress, createWebViewPanel, createViewerWebViewPanel } from '../common';
import { ICustomDerivativeMessage, ICustomDerivativeProps } from '../webviews/custom-translation';
import { ModelDerivativeFormats, svf2 } from '../providers/model-derivative';
import { IVersion } from '../interfaces/hubs';
import { CommandCategory, Command, CommandRegistry, ViewItemContextMenu } from './shared';

@CommandCategory({ category: 'Autodesk Platform Services > Model Derivatives', prefix: 'aps.md' })
export class ModelDerivativesCommands extends CommandRegistry {
	constructor(protected context: IContext, protected refresh: () => void) {
		super();
	}

	@Command({ title: 'Translate Object', icon: 'run' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '1_action_md@2' })
	async translateObject(object?: IObject | IVersion) {
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
			client.submitJob(urn, [{ type: svf2, views: ['2d', '3d'] }], undefined, true);
			vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
		} catch (err) {
			showErrorMessage('Could not translate object', err, this.context);
		}
		this.refresh();
	}

	@Command({ title: 'Translate Object (Custom)', icon: 'run' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '1_action_md@3' })
	async translateObjectCustom(object?: IObject | IVersion) {
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
						// TODO: support additional flags in IDerivativeOutputType
						const outputOptions = {
							type: outputFormat,
							views: ['2d', '3d'],
							advanced: {
								switchLoader,
								generateMasterViews
							}
						} as IDerivativeOutputType;
						try {
							await client.submitJob(
								urn,
								[outputOptions],
								rootFilename,
								true,
								workflowId,
								workflowAttributes ? JSON.parse(workflowAttributes) : {}
							);
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

	@Command({ title: 'List Viewables (JSON)', icon: 'json' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '1_action_md@4' })
	async listViewables(object?: IObject | IVersion) {
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
			const metadata = await withProgress(`Retrieving list of viewables`, client.getMetadata(urn));
			const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(metadata, null, 4), language: 'json' });
			await vscode.window.showTextDocument(doc, { preview: false });
		} catch (err) {
			showErrorMessage('Could not retrieve viewables', err, this.context);
		}
	}

	@Command({ title: 'Preview Derivative', icon: 'preview' })
	@ViewItemContextMenu({ when: 'viewItem == derivative', group: '0_view@1' })
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
				derivative = await promptDerivative(this.context, object.objectId);
				if (!derivative) {
					return;
				}
			}
			const token = inHubs(derivative.urn) && this.context.threeLeggedToken
				? { access_token: this.context.threeLeggedToken }
				: await this.context.authenticationClient.authenticate(['viewables:read']);
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

	@Command({ title: 'View Derivative Tree (JSON)', icon: 'json' })
	@ViewItemContextMenu({ when: 'viewItem == derivative', group: '0_view@2' })
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
				derivative = await promptDerivative(this.context, object.objectId);
				if (!derivative) {
					return;
				}
			}
			const viewable = findViewable(derivative);
			const { urn } = derivative;
			const { guid } = viewable;
			const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
			let forceDownload = false;
			let tree: IDerivativeTree | undefined = undefined;
			try {
				tree = await withProgress(`Retrieving viewable tree`, client.getViewableTree(urn, guid));
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
							tree = await withProgress(`Downloading viewable tree`, client.getViewableTree(urn, guid, true));
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
					fse.ensureFileSync(uri.fsPath);
					fse.writeJsonSync(uri.fsPath, tree, { spaces: 4 });
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

	@Command({ title: 'View Derivative Properties (JSON)', icon: 'json' })
	@ViewItemContextMenu({ when: 'viewItem == derivative', group: '0_view@3' })
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
				derivative = await promptDerivative(this.context, object.objectId);
				if (!derivative) {
					return;
				}
			}
			const viewable = findViewable(derivative);
			const { urn } = derivative;
			const { guid } = viewable;
			const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
			let forceDownload = false;
			let props: IDerivativeProps | undefined = undefined;
			try {
				props = await withProgress(`Retrieving viewable properties`, client.getViewableProperties(urn, guid));
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
							props = await withProgress(`Downloading viewable properties`, client.getViewableProperties(urn, guid, true));
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
					fse.ensureFileSync(uri.fsPath);
					fse.writeJsonSync(uri.fsPath, props, { spaces: 4 });
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

	@Command({ title: 'View Object Manifest (JSON)', icon: 'json' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '0_view@4' })
	async viewObjectManifest(object?: IObject | IVersion) {
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

	@Command({ title: 'View Object Thumbnails', icon: 'eye' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '0_view@3' })
	async viewObjectThumbnail(object?: IObject | IVersion) {
		async function downloadThumbnail(buff: ArrayBuffer, defaultUri: vscode.Uri) {
			const uri = await vscode.window.showSaveDialog({ defaultUri });
			if (!uri) {
				return;
			}
			fs.writeFileSync(uri.fsPath, Buffer.from(buff), { encoding: 'binary' });
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
						client.getThumbnail(urn, ThumbnailSize.Small),
						client.getThumbnail(urn, ThumbnailSize.Medium),
						client.getThumbnail(urn, ThumbnailSize.Large)
					]);
				});
				const pngToDataURI = (img: ArrayBuffer) => 'data:image/png;base64,' + Buffer.from(img).toString('base64');
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

	@Command({ title: 'Delete Object Manifest', icon: 'trash' })
	@ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '3_remove@2' })
	async deleteObjectManifest(object?: IObject) {
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

			const urn = urnify(object.objectId);

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

	@Command({ title: 'Download Derivatives as SVF', icon: 'cloud-download' })
	@ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action_md@5' })
	async downloadDerivativeSvf(object?: IObject) {
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

			const outputFolderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
			if (!outputFolderUri) {
				return;
			}

			const baseDir = outputFolderUri[0].fsPath;
			const urn = urnify(object.objectId);
			let cancelled = false;
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading SVF: ${object.objectKey}`,
				cancellable: true
			}, async (progress, token) => {
				let cancelled = false;
				const svfDownloader = new SvfDownloader(new TwoLeggedAuthenticationProvider(this.context.environment.clientId, this.context.environment.clientSecret));
				const svfDownloadTask = svfDownloader.download(urn, {
					outputDir: baseDir,
					log: (message: string) => {
						this.context.log.info(message);
						progress.report({ message });
					}
				});
				token.onCancellationRequested(() => {
					svfDownloadTask.cancel();
					cancelled = true;
				});
				await svfDownloadTask.ready;
			});
			const action = await vscode.window.showInformationMessage(`Derivative download to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not download SVF`, err, this.context);
		}
	}

	@Command({ title: 'Download Derivatives as F2D', icon: 'cloud-download' })
	@ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action_md@6' })
	async downloadDerivativesF2D(object?: IObject) {
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

			const outputFolderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
			if (!outputFolderUri) {
				return;
			}

			const baseDir = outputFolderUri[0].fsPath;
			const urn = urnify(object.objectId);
			let cancelled = false;
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading F2D: ${object.objectKey}`,
				cancellable: true
			}, async (progress, token) => {
				let cancelled = false;
				const f2dDownloader = new F2dDownloader(new TwoLeggedAuthenticationProvider(this.context.environment.clientId, this.context.environment.clientSecret));
				const f2dDownloadTask = f2dDownloader.download(urn, {
					outputDir: baseDir,
					log: (message: string) => progress.report({ message })
				});
				token.onCancellationRequested(() => {
					f2dDownloadTask.cancel();
					cancelled = true;
				});
				await f2dDownloadTask.ready;
			});
			const action = await vscode.window.showInformationMessage(`Derivative download to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not download F2D`, err, this.context);
		}
	}

	@Command({ title: 'Download Derivatives as glTF', icon: 'cloud-download' })
	@ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action_md@7' })
	async downloadDerivativeGltf(object?: IObject) {
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

			const outputFolderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
			if (!outputFolderUri) {
				return;
			}

			const { objectKey } = object;
			const baseDir = outputFolderUri[0].fsPath;
			const urn = urnify(object.objectId);
			let cancelled = false;
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading glTF: ${objectKey}`,
				cancellable: true
			}, async (progress, token) => {
				token.onCancellationRequested(() => {
					cancelled = true;
				});
				// Store all viewables under a folder named after the OSS object key.
				const urnDir = path.join(baseDir, objectKey.replace(/[^a-zA-Z0-9\.]/g, '_').toLowerCase());
				fse.ensureDirSync(urnDir);
				progress.report({ message: 'Retrieving manifest' });
				const client = inHubs(urn) && this.context.threeLeggedToken ? this.context.modelDerivativeClient3L : this.context.modelDerivativeClient2L;
				const manifest = await client.getManifest(urn);
				const helper = new ManifestHelper(manifest);
				const derivatives = helper.search({ type: 'resource', role: 'graphics' }) as IDerivativeResourceChild[];
				for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
					if (cancelled) { return; }
					progress.report({ message: `Converting derivative ${derivative.guid}` });
					const guidDir = path.join(urnDir, derivative.guid);
					fse.ensureDirSync(guidDir);
					const writer = new GltfWriter({ deduplicate: false, log: (msg: string) => progress.report({ message: msg }) });
					const reader = await SvfReader.FromDerivativeService(urn, derivative.guid, new TwoLeggedAuthenticationProvider(this.context.environment.clientId, this.context.environment.clientSecret));
					const svf = await reader.read();
					await writer.write(svf, guidDir);
				}
			});
			const action = await vscode.window.showInformationMessage(`Derivative translation to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not convert derivatives`, err, this.context);
		}
	}

	@Command({ title: 'Download Non-SVF derivatives', icon: 'cloud-download' })
	@ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == non-viewable-derivative', group: '1_action_md@8' })
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

				object = await promptCustomDerivative(this.context, bucketObject.objectId, formats);

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
				fse.ensureDirSync(baseDir);
				const content = await this.context.modelDerivativeClient2L.getDerivative(object!.urn, encodeURI(object!.bubble.fileUrn));
				await fse.writeFile(targetFileName, new Uint8Array(content));
			});

			const action = await vscode.window.showInformationMessage('Derivative downloaded successfully', 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not download the derivative`, err, this.context);
		}
	}

	@Command({ title: 'Copy Object URN to Clipboard', icon: 'copy' })
	@ViewItemContextMenu({ when: '(view == apsDataManagementView && viewItem == object) || (view == apsHubsView && viewItem == version)', group: '1_action_md@1' })
	async copyObjectUrn(object?: IObject | IVersion) {
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

function getKey(object: IObject | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectKey;
	} else if ('itemId' in object) { //IVersion
		return object.itemId;
	}
	return '';
}

function getId(object: IObject | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectId;
	} else if ('itemId' in object) { //IVersion
		return object.id;
	}
	return '';
}

function getURN(object: IObject | IVersion): string {
	return urnify(getId(object));
}

function getFileExtension(object: IObject | IVersion): string {
	if ("objectKey" in object) {
		return path.extname(object.objectKey).substring(1).toLowerCase();
	}
	return "";
}

function getModelDerivativeClientForObject(object: IObject | IVersion, context: IContext): ModelDerivativeClient {
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
