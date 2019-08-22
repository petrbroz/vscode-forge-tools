import * as vscode from 'vscode';
import * as fs from 'fs';
import {
	IObject,
	urnify,
	ThumbnailSize
} from 'forge-server-utils';
import { IContext, promptBucket, promptObject, promptDerivative } from '../common';
import { IDerivative } from '../interfaces/model-derivative';

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
		const rootDesignFilename = await vscode.window.showInputBox({ prompt: 'If this is a compressed file, enter the filename of the root design' });
		if (rootDesignFilename) {
			await context.modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], rootDesignFilename, true);
		} else {
			await context.modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], undefined, true);
		}
		vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
    } catch(err) {
        vscode.window.showErrorMessage(`Could not translate object: ${JSON.stringify(err.message)}`);
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
		vscode.window.showErrorMessage(`Could not access derivative tree: ${JSON.stringify(err.message)}`);
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
		vscode.window.showErrorMessage(`Could not access derivative properties: ${JSON.stringify(err.message)}`);
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
			`, 'Translate');
			if (action === 'Translate') {
				await translateObject(object, context);
			}
		}
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access object manifest: ${JSON.stringify(err.message)}`);
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
			`, 'Translate');
			if (action === 'Translate') {
				await translateObject(object, context);
			}
		}
		vscode.window.showInformationMessage(`Derivatives deleted: ${object.objectKey}`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not delete derivatives: ${JSON.stringify(err.message)}`);
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
			`, 'Translate');
			if (action === 'Translate') {
				await translateObject(object, context);
			}
		}
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access object thumbnails: ${JSON.stringify(err.message)}`);
	}
}
