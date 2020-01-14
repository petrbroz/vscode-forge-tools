import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as zlib from 'zlib';
import {
	IObject,
	urnify,
	ThumbnailSize,
	ManifestHelper,
	IDerivativeResourceChild,
	IDerivativeOutputType,
	IDerivativeProps,
	IDerivativeTree
} from 'forge-server-utils';
import { SvfReader, GltfWriter } from 'forge-convert-utils';
import { IContext, promptBucket, promptObject, promptDerivative, showErrorMessage } from '../common';
import { IDerivative } from '../interfaces/model-derivative';

enum TranslationActions {
	Translate = 'Translate',
	TranslateAsArchive = 'Translate as Archive'
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
		await context.modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], undefined, true);
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
						const { compressedRootDesign, switchLoader, generateMasterViews } = message.parameters;
						// TODO: support additional flags in IDerivativeOutputType
						const outputOptions = { type: 'svf', views: ['2d', '3d'], advanced: { switchLoader, generateMasterViews } } as IDerivativeOutputType;
						// TODO: support custom region
						await context.modelDerivativeClient.submitJob(urn, [outputOptions], compressedRootDesign, true);
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
		const token = await context.authenticationClient.authenticate(['viewables:read']);
		const panel = vscode.window.createWebviewPanel(
			'derivative-preview',
			'Preview: ' + derivative.name,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('derivative-preview', {
			viewer: {
				config: JSON.stringify({ extensions: context.previewSettings.extensions })
			},
			urn: derivative.urn,
			guid: derivative.guid,
			name: derivative.name,
			token
		});
	} catch (err) {
		vscode.window.showErrorMessage(`Could not access object: ${JSON.stringify(err.message)}`);
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
		let forceDownload = false;
		let tree: IDerivativeTree | undefined = undefined;
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Retrieving viewable tree`,
				cancellable: false
			}, async (progress, token) => {
				tree = await context.modelDerivativeClient.getViewableTree(urn, guid);
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
							tree = await context.modelDerivativeClient.getViewableTree(urn, guid, true);
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
			const content = JSON.stringify(tree);
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
		let forceDownload = false;
		let props: IDerivativeProps | undefined = undefined;
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Retrieving viewable properties`,
				cancellable: false
			}, async (progress, token) => {
				props = await context.modelDerivativeClient.getViewableProperties(urn, guid);
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
							props = await context.modelDerivativeClient.getViewableProperties(urn, guid, true);
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
			const content = JSON.stringify(props);
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
		const manifest = await context.modelDerivativeClient.getManifest(urnify(object.objectId));
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

		try {
			await context.modelDerivativeClient.deleteManifest(urnify(object.objectId));
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
			const urn = urnify(objectId);
			const small = await context.modelDerivativeClient.getThumbnail(urn, ThumbnailSize.Small);
			const medium = await context.modelDerivativeClient.getThumbnail(urn, ThumbnailSize.Medium);
			const large = await context.modelDerivativeClient.getThumbnail(urn, ThumbnailSize.Large);
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

export async function downloadDerivatives(object: IObject | undefined, context: IContext) {
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
			token.onCancellationRequested(() => {
				cancelled = true;
			});
			progress.report({ message: 'Retrieving manifest' });
			const manifest = await context.modelDerivativeClient.getManifest(urn);
			const helper = new ManifestHelper(manifest);
			const derivatives = helper.search({ type: 'resource', role: 'graphics' }) as IDerivativeResourceChild[];

			const urnDir = path.join(baseDir, urn);
			fse.ensureDirSync(urnDir);
			// Download all SVF derivatives
			for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
				if (cancelled) { return; }
				const guid = derivative.guid;
				progress.report({ message: `Downloading SVF derivative ${guid}` });
				const guidDir = path.join(urnDir, guid);
				fse.ensureDirSync(guidDir);
				const svf = await context.modelDerivativeClient.getDerivative(urn, derivative.urn);
				fs.writeFileSync(path.join(guidDir, 'output.svf'), svf);

				const reader = await SvfReader.FromDerivativeService(urn, guid, context.credentials);
				const manifest = await reader.getManifest();
				let failedAssetUris = [];
				// TODO: download assets in parallel
				for (const asset of manifest.assets) {
					if (cancelled) { return; }
					if (!asset.URI.startsWith('embed:')) {
						progress.report({ message: `Downloading SVF derivative ${guid} asset ${asset.URI}` });
						try {
							const assetData = await reader.getAsset(asset.URI);
							const assetPath = path.join(guidDir, asset.URI);
							const assetFolder = path.dirname(assetPath);
							fse.ensureDirSync(assetFolder);
							fs.writeFileSync(assetPath, assetData);
						} catch(err) {
							failedAssetUris.push(asset.URI);
						}
					}
				}

				if (failedAssetUris.length > 0) {
					vscode.window.showWarningMessage('Some of the SVF assets could not be downloaded:\n' + failedAssetUris.join('\n'));
				}
			}
			// Download all F2D derivatives
			for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-f2d')) {
				if (cancelled) { return; }
				const guid = derivative.guid;
				progress.report({ message: `Downloading F2D derivative ${guid}` });
				const guidDir = path.join(urnDir, guid);
				fse.ensureDirSync(guidDir);
				const baseUrn = derivative.urn.substr(0, derivative.urn.lastIndexOf('/'));
				const manifestGzip = await context.modelDerivativeClient.getDerivative(urn, baseUrn + '/manifest.json.gz');
				fs.writeFileSync(path.join(guidDir, 'manifest.json.gz'), manifestGzip);
				const manifestGunzip = zlib.gunzipSync(manifestGzip);
				const manifest = JSON.parse(manifestGunzip.toString());
				let failedAssetUris = [];
				for (const asset of manifest.assets) {
					progress.report({ message: `Downloading F2D derivative ${guid} asset ${asset.id}` });
					try {
						const assetData = await context.modelDerivativeClient.getDerivative(urn, baseUrn + '/' + asset.URI);
						fs.writeFileSync(path.join(guidDir, asset.URI), assetData);
					} catch(err) {
						failedAssetUris.push(asset.id);
					}
				}
				if (failedAssetUris.length > 0) {
					vscode.window.showWarningMessage('Some of the F2D assets could not be downloaded:\n' + failedAssetUris.join('\n'));
				}
			}
		});
		const action = await vscode.window.showInformationMessage(`Derivative download to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
		if (action === 'Open Folder') {
			vscode.env.openExternal(vscode.Uri.file(baseDir));
		}
	} catch (err) {
		vscode.window.showErrorMessage(`Could not download derivatives: ${JSON.stringify(err.message)}`);
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

		const baseDir = outputFolderUri[0].fsPath;
		const urn = urnify(object.objectId);
		let cancelled = false;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Downloading glTF: ${object.objectKey}`,
			cancellable: true
		}, async (progress, token) => {
			token.onCancellationRequested(() => {
				cancelled = true;
			});
			const urnDir = path.join(baseDir, urn);
			fse.ensureDirSync(urnDir);
			progress.report({ message: 'Retrieving manifest' });
			const manifest = await context.modelDerivativeClient.getManifest(urn);
			const helper = new ManifestHelper(manifest);
			const derivatives = helper.search({ type: 'resource', role: 'graphics' }) as IDerivativeResourceChild[];
			for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
				if (cancelled) { return; }
				progress.report({ message: `Converting derivative ${derivative.guid}` });
				const guidDir = path.join(urnDir, derivative.guid);
				fse.ensureDirSync(guidDir);
				const writer = new GltfWriter({ deduplicate: false, compress: false, binary: false, log: (msg: string) => progress.report({ message: msg }) });
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
		vscode.window.showErrorMessage(`Could not convert derivatives: ${JSON.stringify(err.message)}`);
	}
}

export async function downloadDerivativeGLB(object: IObject | undefined, context: IContext) {
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
			title: `Downloading glTF: ${object.objectKey}`,
			cancellable: true
		}, async (progress, token) => {
			token.onCancellationRequested(() => {
				cancelled = true;
			});
			const urnDir = path.join(baseDir, urn);
			fse.ensureDirSync(urnDir);
			progress.report({ message: 'Retrieving manifest' });
			const manifest = await context.modelDerivativeClient.getManifest(urn);
			const helper = new ManifestHelper(manifest);
			const derivatives = helper.search({ type: 'resource', role: 'graphics' }) as IDerivativeResourceChild[];
			for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
				if (cancelled) { return; }
				progress.report({ message: `Converting derivative ${derivative.guid}` });
				const guidDir = path.join(urnDir, derivative.guid);
				fse.ensureDirSync(guidDir);
				const writer = new GltfWriter({ deduplicate: true, compress: true, binary: true, skipUnusedUvs: true, log: (msg: string) => progress.report({ message: msg }) });
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
		vscode.window.showErrorMessage(`Could not convert derivatives: ${JSON.stringify(err.message)}`);
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
		vscode.window.showInformationMessage(`Object URN copied to clipboard: ${urn}`,);
	} catch (err) {
		showErrorMessage('Could not obtain object URN', err);
	}
}
