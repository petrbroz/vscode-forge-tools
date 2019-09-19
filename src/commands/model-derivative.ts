import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import {
	IObject,
	urnify,
	ThumbnailSize,
	ManifestHelper,
	IDerivativeResourceChild
} from 'forge-server-utils';
import { parseManifest } from 'forge-server-utils/dist/svf';
import { IContext, promptBucket, promptObject, promptDerivative, showErrorMessage } from '../common';
import { IDerivative } from '../interfaces/model-derivative';

enum TranslationActions {
	Translate = 'Translate',
	TranslateAsArchive = 'Translate as Archive'
}

export async function translateObject(object: IObject | undefined, compressed: boolean, context: IContext) {
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
		if (compressed) {
			const rootDesignFilename = await vscode.window.showInputBox({ prompt: 'Enter the filename of the root design' });
			if (!rootDesignFilename) {
				return;
			}
			await context.modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], rootDesignFilename, true);
		} else {
			await context.modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], undefined, true);
		}
		vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
    } catch(err) {
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
		panel.webview.html = context.templateEngine.render('derivative-preview', { urn: derivative.urn, guid: derivative.guid, name: derivative.name, token });
	} catch(err) {
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
		const panel = vscode.window.createWebviewPanel(
			'derivative-tree',
			'Tree: ' + derivative.name,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('spinner', {});
		const graphicsNode = derivative.bubble.children.find((child: any) => child.role === 'graphics');
		const tree = await context.modelDerivativeClient.getViewableTree(derivative.urn, graphicsNode.guid) as any;
		panel.webview.html = context.templateEngine.render('derivative-tree', { urn: derivative.urn, guid: derivative.guid, objects: tree.data.objects });
	} catch(err) {
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
		const panel = vscode.window.createWebviewPanel(
			'derivative-props',
			'Properties: ' + derivative.name,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('spinner', {});
		const graphicsNode = derivative.bubble.children.find((child: any) => child.role === 'graphics');
		const props = await context.modelDerivativeClient.getViewableProperties(derivative.urn, graphicsNode.guid) as any;
		panel.webview.html = context.templateEngine.render('derivative-props', { urn: derivative.urn, guid: derivative.guid, objects: props.data.collection });
	} catch(err) {
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

		const panel = vscode.window.createWebviewPanel(
			'object-manifest',
			'Manifest: ' + object.objectKey,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		try {
			const manifest = await context.modelDerivativeClient.getManifest(urnify(object.objectId));
			panel.webview.html = context.templateEngine.render('object-manifest', { object, manifest });
		} catch(_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the manifest of ${object.objectId}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await translateObject(object, false, context);
					break;
				case TranslationActions.TranslateAsArchive:
					await translateObject(object, true, context);
					break;
			}
		}
	} catch(err) {
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
		} catch(_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the manifest of ${object.objectId}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await translateObject(object, false, context);
					break;
				case TranslationActions.TranslateAsArchive:
					await translateObject(object, true, context);
					break;
			}
		}
		vscode.window.showInformationMessage(`Derivatives deleted: ${object.objectKey}`);
	} catch(err) {
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
		} catch(_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the thumbnails of ${object.objectId}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await translateObject(object, false, context);
					break;
				case TranslationActions.TranslateAsArchive:
					await translateObject(object, true, context);
					break;
			}
		}
	} catch(err) {
		showErrorMessage('Could not access derivative thumbnails', err);
	}
}

export async function downloadDerivativeSVF(object: IObject | undefined, context: IContext) {
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
    		for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
				if (cancelled) { return; }
				const guid = derivative.guid;
				progress.report({ message: `Downloading derivative ${guid}` });
				const guidDir = path.join(urnDir, guid);
				fse.ensureDirSync(guidDir);
        		const svf = await context.modelDerivativeClient.getDerivative(urn, derivative.urn);
				fs.writeFileSync(path.join(guidDir, 'output.svf'), svf);

				const baseUri = derivative.urn.substr(0, derivative.urn.lastIndexOf('/'));
				const { manifest, metadata } = parseManifest(svf as Buffer);
				// TODO: download assets in parallel
				for (const asset of manifest.assets) {
					if (cancelled) { return; }
					if (!asset.URI.startsWith('embed:')) {
						progress.report({ message: `Downloading derivative ${guid} asset ${asset.URI}` });
						const assetData = await context.modelDerivativeClient.getDerivative(urn, baseUri + '/' + asset.URI);
						const assetPath = path.join(guidDir, asset.URI);
						const assetFolder = path.dirname(assetPath);
						fse.ensureDirSync(assetFolder);
						fs.writeFileSync(assetPath, assetData);
					}
				}
    		}
		});
		const action = await vscode.window.showInformationMessage(`Derivative download to ${baseDir} ${cancelled ? 'cancelled' : 'succeeded'}.`, 'Open Folder');
		if (action === 'Open Folder') {
			vscode.env.openExternal(vscode.Uri.file(baseDir));
		}
	} catch(err) {
		vscode.window.showErrorMessage(`Could not download derivatives: ${JSON.stringify(err.message)}`);
	}
}
