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
	IDerivativeTree
} from 'forge-server-utils';
import { SvfReader, GltfWriter, SvfDownloader, F2dDownloader, OtgDownloader } from 'forge-convert-utils';
import { IContext, promptBucket, promptObject, promptDerivative, showErrorMessage, inHubs } from '../common';
import { IDerivative } from '../interfaces/model-derivative';

enum TranslationActions {
	Translate = 'Translate',
	TranslateAsArchive = 'Translate as Archive'
}

function urnify(id: string): string {
	return _urnify(id).replace('/', '_');
}

export async function translateObject(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = urnify(object.objectId);
		await context.modelDerivativeClient2L.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], undefined, true);
		vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
	} catch (err) {
		showErrorMessage('Could not translate object', err);
	}
}

export async function translateObjectCustom(object: IObject | undefined, context: IContext, onStart?: () => void) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = urnify(object.objectId);
		const panel = vscode.window.createWebviewPanel(
			'custom-translation',
			'Custom Model Derivative Job',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('custom-translation', { urn });
		panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'start':
						const { compressedRootDesign, switchLoader, generateMasterViews, outputFormat } = message.parameters;
						// TODO: support additional flags in IDerivativeOutputType
						const outputOptions = {
							type: outputFormat,
							views: ['2d', '3d'],
							advanced: {
								switchLoader,
								generateMasterViews
							}
						} as IDerivativeOutputType;
						// TODO: support custom region
						await context.modelDerivativeClient2L.submitJob(urn, [outputOptions], compressedRootDesign, true);
						panel.dispose();
						vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
						if (onStart) {
							onStart();
						}
						break;
					case 'cancel':
						panel.dispose();
						break;
				}
			},
			undefined,
			context.extensionContext.subscriptions
		);
	} catch (err) {
		showErrorMessage('Could not translate object', err);
	}
}

export async function previewDerivative(derivative: IDerivative | undefined, context: IContext) {
	try {
		if (!derivative) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			const object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
			derivative = await promptDerivative(context, object.objectId);
			if (!derivative) {
				return;
			}
		}
		const token = inHubs(derivative.urn) && context.threeLeggedToken
			? { access_token: context.threeLeggedToken }
			: await context.authenticationClient.authenticate(['viewables:read']);
		const panel = vscode.window.createWebviewPanel(
			'derivative-preview',
			'Preview: ' + derivative.name,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('derivative-preview', {
			viewer: {
				config: JSON.stringify({ extensions: context.previewSettings.extensions }),
				env: context.previewSettings.env || (derivative.format === 'svf2' ? 'MD20ProdUS' : 'AutodeskProduction'),
				api: context.previewSettings.api || (derivative.format === 'svf2' ? 'D3S' : 'derivativeV2')
			},
			urn: derivative.urn,
			guid: derivative.guid,
			name: derivative.name,
			token
		});
	} catch (err) {
		showErrorMessage(`Could not access object`, err);
	}
}

export async function viewDerivativeTree(derivative: IDerivative | undefined, context: IContext) {
	try {
		if (!derivative) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			const object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
			derivative = await promptDerivative(context, object.objectId);
			if (!derivative) {
				return;
			}
		}
		const graphicsNode = derivative.bubble.children.find((child: any) => child.role === 'graphics');
		const urn = derivative.urn, guid = graphicsNode.guid;
		const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
		let forceDownload = false;
		let tree: IDerivativeTree | undefined = undefined;
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Retrieving viewable tree`,
				cancellable: false
			}, async (progress, token) => {
				tree = await client.getViewableTree(urn, guid);
			});
		} catch (err) {
			// Forge may respond with code 413 to indicate that the requested JSON data is too large.
			// In that case, offer an option of downloading the content to a local file.
			if (err.isAxiosError && err.response.status === 413) {
				const action = await vscode.window.showInformationMessage(`
					Cannot obtain viewable tree, possibly because the content is too large.
					Would you like to try and force-download the tree JSON?
				`, 'Force Download', 'Cancel');
				switch (action) {
					case 'Force Download':
						await vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: `Downloading viewable tree`,
							cancellable: false
						}, async (progress, token) => {
							// TODO: redirect the downloaded data directly into a file stream
							tree = await client.getViewableTree(urn, guid, true);
							forceDownload = true;
						});
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
		showErrorMessage('Could not access derivative tree', err);
	}
}

export async function viewDerivativeProps(derivative: IDerivative | undefined, context: IContext) {
	try {
		if (!derivative) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			const object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
			derivative = await promptDerivative(context, object.objectId);
			if (!derivative) {
				return;
			}
		}
		const graphicsNode = derivative.bubble.children.find((child: any) => child.role === 'graphics');
		const urn = derivative.urn, guid = graphicsNode.guid;
		const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
		let forceDownload = false;
		let props: IDerivativeProps | undefined = undefined;
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Retrieving viewable properties`,
				cancellable: false
			}, async (progress, token) => {
				props = await client.getViewableProperties(urn, guid);
			});
		} catch (err) {
			// Forge may respond with code 413 to indicate that the requested JSON data is too large.
			// In that case, offer an option of downloading the content to a local file.
			if (err.isAxiosError && err.response.status === 413) {
				const action = await vscode.window.showInformationMessage(`
					Cannot obtain viewable properties, possibly because the content is too large.
					Would you like to try and force-download the property JSON?
				`, 'Force Download', 'Cancel');
				switch (action) {
					case 'Force Download':
						await vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: `Downloading viewable properties`,
							cancellable: false
						}, async (progress, token) => {
							// TODO: redirect the downloaded data directly into a file stream
							props = await client.getViewableProperties(urn, guid, true);
							forceDownload = true;
						});
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
		showErrorMessage('Could not access derivative properties', err);
	}
}

export async function viewObjectManifest(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}
		const urn = urnify(object.objectId);
		const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
		const manifest = await client.getManifest(urn);
		const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(manifest, null, 4), language: 'json' });
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch (err) {
		showErrorMessage('Could not access object manifest', err);
	}
}

export async function deleteObjectManifest(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = urnify(object.objectId);
		const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
		try {
			await client.deleteManifest(urn);
		} catch (_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the manifest of ${object.objectId}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await translateObject(object, context);
					break;
				case TranslationActions.TranslateAsArchive:
					await translateObject(object, context);
					break;
			}
		}
		vscode.window.showInformationMessage(`Derivatives deleted: ${object.objectKey}`);
	} catch (err) {
		showErrorMessage('Could not delete derivatives', err);
	}
}

export async function viewObjectThumbnail(object: IObject | undefined, context: IContext) {
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
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}
		const { objectId, objectKey } = object;

		const panel = vscode.window.createWebviewPanel(
			'object-thumbnail',
			'Thumbnail: ' + object.objectKey,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		try {
			// Hack: if there's a '_' in the urn, it's a version of an item from hubs, so we need a 3-legged token
			const urn = urnify(objectId);
			const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
			const small = await client.getThumbnail(urn, ThumbnailSize.Small);
			const medium = await client.getThumbnail(urn, ThumbnailSize.Medium);
			const large = await client.getThumbnail(urn, ThumbnailSize.Large);
			const pngToDataURI = (img: ArrayBuffer) => 'data:image/png;base64,' + Buffer.from(img).toString('base64');
			panel.webview.html = context.templateEngine.render('object-thumbnail', {
				object,
				smallDataURI: pngToDataURI(small),
				mediumDataURI: pngToDataURI(medium),
				largeDataURI: pngToDataURI(large)
			});
			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'download':
							switch (message.thumbnailSize) {
								case 'small':
									downloadThumbnail(small, vscode.Uri.file(objectKey + '.100x100.png'));
									break;
								case 'medium':
									downloadThumbnail(medium, vscode.Uri.file(objectKey + '.200x200.png'));
									break;
								case 'large':
									downloadThumbnail(large, vscode.Uri.file(objectKey + '.400x400.png'));
									break;
							}
					}
				},
				undefined,
				context.extensionContext.subscriptions
			);
		} catch (_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the thumbnails of ${object.objectId}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await translateObject(object, context);
					break;
				case TranslationActions.TranslateAsArchive:
					await translateObject(object, context);
					break;
			}
		}
	} catch (err) {
		showErrorMessage('Could not access derivative thumbnails', err);
	}
}

export async function downloadDerivativesSVF(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
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
			const svfDownloader = new SvfDownloader(context.credentials);
			const svfDownloadTask = svfDownloader.download(urn, {
				outputDir: baseDir,
				log: (message: string) => progress.report({ message })
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
		showErrorMessage(`Could not download SVF`, err);
	}
}

export async function downloadDerivativesF2D(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
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
			const f2dDownloader = new F2dDownloader(context.credentials);
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
		showErrorMessage(`Could not download F2D`, err);
	}
}

export async function downloadDerivativesOTG(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
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
			title: `Downloading OTG: ${object.objectKey}`,
			cancellable: true
		}, async (progress, token) => {
			let cancelled = false;
			const otgDownloader = new OtgDownloader(context.credentials);
			const otgDownloadTask = otgDownloader.download(urn, {
				outputDir: baseDir,
				log: (message: string) => progress.report({ message })
			});
			token.onCancellationRequested(() => {
				otgDownloadTask.cancel();
				cancelled = true;
			});
			await otgDownloadTask.ready;
		});
		const action = await vscode.window.showInformationMessage(`Derivative download to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
		if (action === 'Open Folder') {
			vscode.env.openExternal(vscode.Uri.file(baseDir));
		}
	} catch (err) {
		showErrorMessage(`Could not download OTG`, err);
	}
}

export async function downloadDerivativeGLTF(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
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
			const client = inHubs(urn) && context.threeLeggedToken ? context.modelDerivativeClient3L : context.modelDerivativeClient2L;
			const manifest = await client.getManifest(urn);
			const helper = new ManifestHelper(manifest);
			const derivatives = helper.search({ type: 'resource', role: 'graphics' }) as IDerivativeResourceChild[];
			for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
				if (cancelled) { return; }
				progress.report({ message: `Converting derivative ${derivative.guid}` });
				const guidDir = path.join(urnDir, derivative.guid);
				fse.ensureDirSync(guidDir);
				const writer = new GltfWriter({ deduplicate: false, log: (msg: string) => progress.report({ message: msg }) });
				const reader = await SvfReader.FromDerivativeService(urn, derivative.guid, context.credentials);
				const svf = await reader.read();
				await writer.write(svf, guidDir);
			}
		});
		const action = await vscode.window.showInformationMessage(`Derivative translation to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
		if (action === 'Open Folder') {
			vscode.env.openExternal(vscode.Uri.file(baseDir));
		}
	} catch (err) {
		showErrorMessage(`Could not convert derivatives`, err);
	}
}

export async function copyObjectUrn(object: IObject | undefined, context: IContext) {
	try {
		if (!object) {
			const bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
			object = await promptObject(context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = urnify(object.objectId);
		await vscode.env.clipboard.writeText(urn);
		vscode.window.showInformationMessage(`Object URN copied to clipboard: ${urn}`);
	} catch (err) {
		showErrorMessage('Could not obtain object URN', err);
	}
}
