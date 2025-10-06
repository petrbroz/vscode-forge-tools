import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { IBucket, IObject, DataRetentionPolicy } from 'aps-sdk-node';
import { IContext, promptBucket, promptObject, showErrorMessage } from '../common';
import { withProgress, createWebViewPanel } from '../common';
import { IHub, IProject, IFolder, IItem, IVersion } from '../interfaces/hubs';

const RetentionPolicyKeys = ['transient', 'temporary', 'persistent'];
const AllowedMimeTypes = {
	'a': 'application/octet-stream',
	'ai': 'application/postscript',
	'aif': 'audio/x-aiff',
	'aifc': 'audio/x-aiff',
	'aiff': 'audio/x-aiff',
	'au': 'audio/basic',
	'avi': 'video/x-msvideo',
	'bat': 'text/plain',
	'bin': 'application/octet-stream',
	'bmp': 'image/x-ms-bmp',
	'c': 'text/plain',
	'cdf': 'application/x-cdf',
	'csh': 'application/x-csh',
	'css': 'text/css',
	'dll': 'application/octet-stream',
	'doc': 'application/msword',
	'dot': 'application/msword',
	'dvi': 'application/x-dvi',
	'eml': 'message/rfc822',
	'eps': 'application/postscript',
	'etx': 'text/x-setext',
	'exe': 'application/octet-stream',
	'gif': 'image/gif',
	'gtar': 'application/x-gtar',
	'h': 'text/plain',
	'hdf': 'application/x-hdf',
	'htm': 'text/html',
	'html': 'text/html',
	'jpe': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'jpg': 'image/jpeg',
	'js': 'application/x-javascript',
	'ksh': 'text/plain',
	'latex': 'application/x-latex',
	'm1v': 'video/mpeg',
	'man': 'application/x-troff-man',
	'me': 'application/x-troff-me',
	'mht': 'message/rfc822',
	'mhtml': 'message/rfc822',
	'mif': 'application/x-mif',
	'mov': 'video/quicktime',
	'movie': 'video/x-sgi-movie',
	'mp2': 'audio/mpeg',
	'mp3': 'audio/mpeg',
	'mp4': 'video/mp4',
	'mpa': 'video/mpeg',
	'mpe': 'video/mpeg',
	'mpeg': 'video/mpeg',
	'mpg': 'video/mpeg',
	'ms': 'application/x-troff-ms',
	'nc': 'application/x-netcdf',
	'nws': 'message/rfc822',
	'o': 'application/octet-stream',
	'obj': 'application/octet-stream',
	'oda': 'application/oda',
	'pbm': 'image/x-portable-bitmap',
	'pdf': 'application/pdf',
	'pfx': 'application/x-pkcs12',
	'pgm': 'image/x-portable-graymap',
	'png': 'image/png',
	'pnm': 'image/x-portable-anymap',
	'pot': 'application/vnd.ms-powerpoint',
	'ppa': 'application/vnd.ms-powerpoint',
	'ppm': 'image/x-portable-pixmap',
	'pps': 'application/vnd.ms-powerpoint',
	'ppt': 'application/vnd.ms-powerpoint',
	'pptx': 'application/vnd.ms-powerpoint',
	'ps': 'application/postscript',
	'pwz': 'application/vnd.ms-powerpoint',
	'py': 'text/x-python',
	'pyc': 'application/x-python-code',
	'pyo': 'application/x-python-code',
	'qt': 'video/quicktime',
	'ra': 'audio/x-pn-realaudio',
	'ram': 'application/x-pn-realaudio',
	'ras': 'image/x-cmu-raster',
	'rdf': 'application/xml',
	'rgb': 'image/x-rgb',
	'roff': 'application/x-troff',
	'rtx': 'text/richtext',
	'sgm': 'text/x-sgml',
	'sgml': 'text/x-sgml',
	'sh': 'application/x-sh',
	'shar': 'application/x-shar',
	'snd': 'audio/basic',
	'so': 'application/octet-stream',
	'src': 'application/x-wais-source',
	'swf': 'application/x-shockwave-flash',
	't': 'application/x-troff',
	'tar': 'application/x-tar',
	'tcl': 'application/x-tcl',
	'tex': 'application/x-tex',
	'texi': 'application/x-texinfo',
	'texinfo': 'application/x-texinfo',
	'tif': 'image/tiff',
	'tiff': 'image/tiff',
	'tr': 'application/x-troff',
	'tsv': 'text/tab-separated-values',
	'txt': 'text/plain',
	'ustar': 'application/x-ustar',
	'vcf': 'text/x-vcard',
	'wav': 'audio/x-wav',
	'wiz': 'application/msword',
	'wsdl': 'application/xml',
	'xbm': 'image/x-xbitmap',
	'xlb': 'application/vnd.ms-excel',
	'xls': 'application/vnd.ms-excel',
	'xlsx': 'application/vnd.ms-excel',
	'xml': 'text/xml',
	'xpdl': 'application/xml',
	'xpm': 'image/x-xpixmap',
	'xsl': 'application/xml',
	'xwd': 'image/x-xwindowdump',
	'zip': 'application/zip'
};
const DeleteBatchSize = 8;

export function registerDataManagementCommands(context: IContext, refresh: () => void) {
    vscode.commands.registerCommand('forge.refreshBuckets', () => {
        refresh();
    });

	// OSS

    vscode.commands.registerCommand('forge.createBucket', async () => {
        await createBucket(context);
        refresh();
    });
    vscode.commands.registerCommand('forge.viewBucketDetails', async (bucket?: IBucket) => {
        await viewBucketDetails(bucket, context);
    });
    vscode.commands.registerCommand('forge.copyBucketKey', async (bucket?: IBucket) => {
        await copyBucketKey(bucket, context);
    });
    vscode.commands.registerCommand('forge.deleteBucketObjects', async (bucket?: IBucket) => {
        await deleteAllObjects(bucket, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.viewObjectDetails', async (object?: IObject) => {
        await viewObjectDetails(object, context);
    });
    vscode.commands.registerCommand('forge.copyObjectKey', async (object?: IObject) => {
        await copyObjectKey(object, context);
    });
    vscode.commands.registerCommand('forge.uploadObject', async (bucket?: IBucket) => {
        await uploadObject(bucket, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.createEmptyObject', async (bucket?: IBucket) => {
        await createEmptyObject(bucket, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.copyObject', async (object?: IObject) => {
        await copyObject(object, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.renameObject', async (object?: IObject) => {
        await renameObject(object, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.downloadObject', async (object?: IObject) => {
        await downloadObject(object, context);
    });
    vscode.commands.registerCommand('forge.deleteObject', async (object?: IObject) => {
        await deleteObject(object, context);
        refresh();
    });
    vscode.commands.registerCommand('forge.generateSignedUrl', async (object?: IObject) => {
        await generateSignedUrl(object, context);
    });
    vscode.commands.registerCommand('forge.deleteBucket', async (bucket?: IBucket) => {
        await deleteBucket(bucket, context);
        refresh();
    });

    // Hubs

    vscode.commands.registerCommand('forge.copyHubID', async (hub?: IHub) => {
        if (!hub) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await vscode.env.clipboard.writeText(hub.id);
        vscode.window.showInformationMessage(`Hub ID copied to clipboard: ${hub.id}`);
    });
    vscode.commands.registerCommand('forge.copyProjectID', async (project?: IProject) => {
        if (!project) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await vscode.env.clipboard.writeText(project.id);
        vscode.window.showInformationMessage(`Project ID copied to clipboard: ${project.id}`);
    });
    vscode.commands.registerCommand('forge.copyFolderID', async (folder?: IFolder) => {
        if (!folder) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await vscode.env.clipboard.writeText(folder.id);
        vscode.window.showInformationMessage(`Folder ID copied to clipboard: ${folder.id}`);
    });
    vscode.commands.registerCommand('forge.copyItemID', async (item?: IItem) => {
        if (!item) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await vscode.env.clipboard.writeText(item.id);
        vscode.window.showInformationMessage(`Item ID copied to clipboard: ${item.id}`);
    });
    vscode.commands.registerCommand('forge.copyVersionID', async (version?: IVersion) => {
        if (!version) {
            vscode.window.showInformationMessage('This command can only be triggered from the tree view.');
            return;
        }
        await vscode.env.clipboard.writeText(version.id);
        vscode.window.showInformationMessage(`Version ID copied to clipboard: ${version.id}`);
    });
}

async function createBucket(context: IContext) {
    const name = await vscode.window.showInputBox({ prompt: 'Enter unique bucket name' });
    if (!name) {
		return;
	}
    const retention = await vscode.window.showQuickPick(RetentionPolicyKeys, { placeHolder: 'Select retention policy' });
    if (!retention) {
		return;
	}

    try {
		const bucket = await withProgress(`Creating bucket: ${name}`, context.dataManagementClient.createBucket(name, <DataRetentionPolicy>retention));
        vscode.window.showInformationMessage(`Bucket created: ${bucket.bucketKey}`);
    } catch (err) {
		showErrorMessage('Could not create bucket', err, context);
    }
}

async function viewBucketDetails(bucket: IBucket | undefined, context: IContext) {
	try {
		if (!bucket) {
			bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
		}

		const { bucketKey } = bucket;
		const bucketDetails = await withProgress(`Getting bucket details: ${bucketKey}`, context.dataManagementClient.getBucketDetails(bucketKey));
		createWebViewPanel(context, 'bucket-details.js', 'bucket-details', `Bucket Details: ${bucketKey}`, { detail: bucketDetails });
		// const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(bucketDetails, null, 4), language: 'json' });
		// await vscode.window.showTextDocument(doc, { preview: false });
	} catch(err) {
		showErrorMessage('Could not access bucket', err, context);
	}
}

async function copyBucketKey(bucket: IBucket | undefined, context: IContext) {
	try {
		if (!bucket) {
			bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
		}

		await vscode.env.clipboard.writeText(bucket.bucketKey);
		vscode.window.showInformationMessage(`Bucket key copied to clipboard: ${bucket.bucketKey}`);
	} catch (err) {
		showErrorMessage('Could not obtain bucket key', err, context);
	}
}

async function uploadObject(bucket: IBucket | undefined, context: IContext) {
	// TODO: re-introduce support for cancellable uploads
	const chunkBytes = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.data.uploadChunkSize') || (2 << 20);

	async function _upload(name: string, uri: vscode.Uri, context: IContext, bucketKey: string, contentType?: string) {
		const filepath = uri.fsPath;
		try {
			const stream = fs.createReadStream(filepath);
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Uploading file: ${filepath}`,
				cancellable: false
			}, async (progress, token) => {
				await context.dataManagementClient.uploadObjectStream(bucketKey, name, stream, {
					contentType,
					progress: (bytesUploaded, totalBytes) => progress.report({ increment: 100.0 * bytesUploaded / totalBytes! })
				});
			});
			const res = await vscode.window.showInformationMessage(`Upload complete: ${filepath}`, 'Translate', 'Translate (Custom)');
			if (res === 'Translate') {
				const obj = await context.dataManagementClient.getObjectDetails(bucketKey, name);
				vscode.commands.executeCommand('forge.translateObject', obj);
			} else if (res === 'Translate (Custom)') {
				const obj = await context.dataManagementClient.getObjectDetails(bucketKey, name);
				vscode.commands.executeCommand('forge.translateObjectCustom', obj);
			}
		} catch (err) {
			showErrorMessage('Could not upload file', err, context);
		}
	}

	if (!bucket) {
		bucket = await promptBucket(context);
		if (!bucket) {
			return;
		}
	}

	const { bucketKey } = bucket;

	// Collect inputs
    const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true });
	if (!uris) {
		return;
	}

	if (uris.length === 1) {
		const name = await vscode.window.showInputBox({ prompt: 'Enter object name', value: path.basename(uris[0].fsPath) });
		if (!name) {
			return;
		}
		// Warn users against uploading files without extension (which is needed by Model Derivative service)
		if (!path.extname(name)) {
			await vscode.window.showWarningMessage('Objects with no file extension in their name cannot be translated by Model Derivative service.');
		}
		// Pick the content type for the uploaded file
		let contentType = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.data.defaultContentType');
		if (!contentType) {
			contentType = await vscode.window.showQuickPick(Object.values(AllowedMimeTypes), { canPickMany: false, placeHolder: 'Select content type' });
			if (!contentType) {
				return;
			}
		}
		await _upload(name, uris[0], context, bucketKey, contentType);
	} else {
		const uploads = uris.map(uri => _upload(path.basename(uri.fsPath), uri, context, bucketKey));
		await Promise.all(uploads);
	}
}

async function createEmptyObject(bucket: IBucket | undefined, context: IContext) {
	if (!bucket) {
		bucket = await promptBucket(context);
		if (!bucket) {
			return;
		}
	}

	const { bucketKey } = bucket;

    const name = await vscode.window.showInputBox({ prompt: 'Enter object name' });
    if (!name) {
		return;
	}
	let contentType = vscode.workspace.getConfiguration(undefined, null).get<string>('autodesk.forge.data.defaultContentType');
	if (!contentType) {
		contentType = await vscode.window.showQuickPick(Object.values(AllowedMimeTypes), { canPickMany: false, placeHolder: 'Select content type' });
	}
    if (!contentType) {
		return;
	}

    try {
		const signedUrl = await context.dataManagementClient.createSignedUrl(bucketKey, name, "write");
		const { data } = await axios.put(signedUrl.signedUrl, Buffer.from([]));
		vscode.window.showInformationMessage(`Object created: ${data.objectId}`);
    } catch(err) {
		showErrorMessage('Could not create file', err, context);
	}
}

async function downloadObject(object: IObject | undefined, context: IContext) {
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
	const { objectKey, bucketKey } = object;

    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(objectKey) });
    if (!uri) {
		return;
	}

    try {
		const arrayBuffer = await withProgress(`Downloading file: ${uri.fsPath}`, context.dataManagementClient.downloadObject(bucketKey, objectKey));
		fs.writeFileSync(uri.fsPath, Buffer.from(arrayBuffer), { encoding: 'binary' });
		const action = await vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`, 'Open File');
		if (action === 'Open File') {
			vscode.env.openExternal(uri);
		}
    } catch(err) {
		showErrorMessage('Could not download file', err, context);
    }
}

async function viewObjectDetails(object: IObject | undefined, context: IContext) {
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

		const { objectKey, bucketKey } = object;
		const objectDetails = await withProgress(`Getting object details: ${objectKey}`, context.dataManagementClient.getObjectDetails(bucketKey, objectKey));
		createWebViewPanel(context, 'object-details.js', 'object-details', `Object Details: ${objectKey}`, { detail: objectDetails });
		// const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(objectDetails, null, 4), language: 'json' });
		// await vscode.window.showTextDocument(doc, { preview: false });
	} catch(err) {
		showErrorMessage('Could not access object', err, context);
	}
}

async function copyObjectKey(object: IObject | undefined, context: IContext) {
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

		await vscode.env.clipboard.writeText(object.objectKey);
		vscode.window.showInformationMessage(`Object key copied to clipboard: ${object.objectKey}`);
	} catch (err) {
		showErrorMessage('Could not obtain object key', err, context);
	}
}

async function copyObject(object: IObject | undefined, context: IContext) {
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
		const newObjectKey = await vscode.window.showInputBox({ prompt: 'Enter new object name' });
		if (!newObjectKey) {
			return;
		}

		const { bucketKey, objectKey } = object;
		await withProgress(`Copying file: ${object.objectKey}`, context.dataManagementClient.copyObject(bucketKey, objectKey, newObjectKey));
        vscode.window.showInformationMessage(`Object copy created: ${newObjectKey}`);
	} catch(err) {
		showErrorMessage('Could not copy object', err, context);
	}
}

async function renameObject(object: IObject | undefined, context: IContext) {
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
		const newObjectKey = await vscode.window.showInputBox({ prompt: 'Enter new object name' });
		if (!newObjectKey) {
			return;
		}

		const { bucketKey, objectKey } = object;
		await withProgress(`Renaming file: ${object.objectKey}`, context.dataManagementClient.copyObject(bucketKey, objectKey, newObjectKey));
		await withProgress(`Renaming file: ${object.objectKey}`, context.dataManagementClient.deleteObject(bucketKey, objectKey));
        vscode.window.showInformationMessage(`
            Object successfully renamed to ${newObjectKey}. Note that any derivatives created for
            the object's original name will not be accesible now but they still exist. You can
            either start another conversion job for this object with its new name, or rename
            the object back to ${object.objectKey} to regain access to the derivatives.
        `);
	} catch(err) {
		showErrorMessage('Could not rename object', err, context);
	}
}

async function deleteObject(object: IObject | undefined, context: IContext) {
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

		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete object: ${object.objectKey}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		const { bucketKey, objectKey } = object;
		await withProgress(`Deleting object: ${object.objectKey}`, context.dataManagementClient.deleteObject(bucketKey, objectKey));
        vscode.window.showInformationMessage(`Object deleted: ${object.objectKey}`);
    } catch(err) {
		showErrorMessage('Could not delete object', err, context);
    }
}

async function deleteAllObjects(bucket: IBucket | undefined, context: IContext) {
	try {
		if (!bucket) {
			bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
		}

		const { bucketKey } = bucket;
		const objects = await context.dataManagementClient.listObjects(bucketKey);
		if (objects.length === 0) {
			vscode.window.showInformationMessage('No objects to delete');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete all objects in bucket: ${bucket.bucketKey}? This action cannot be undone.`, { modal: true }, 'Delete All');
		if (confirm !== 'Delete All') {
			return;
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Deleting all objects in bucket: ${bucket.bucketKey}`,
			cancellable: true
		}, async (progress, token) => {
			let cancelled = false;
			token.onCancellationRequested(() => {
				cancelled = true;
			});
			let batch = [];
			progress.report({ increment: 0 });
			for (let i = 0, len = objects.length; i < len; i++) {
				if (cancelled) {
					break;
				}
				batch.push(context.dataManagementClient.deleteObject(bucketKey, objects[i].objectKey));
				if (batch.length === DeleteBatchSize || i === len - 1) {
					await Promise.all(batch);
					progress.report({ increment: 100.0 * batch.length / len });
					batch = [];
				}
			}
		});
        vscode.window.showInformationMessage(`Objects deleted`);
    } catch(err) {
		showErrorMessage('Could not delete objects', err, context);
    }
}

async function generateSignedUrl(object: IObject | undefined, context: IContext) {
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
		const { objectKey, bucketKey } = object;
		const permissions = await vscode.window.showQuickPick(['read', 'write', 'readwrite'], {
			canPickMany: false, placeHolder: 'Select access permissions for the new URL'
		});
		if (!permissions) {
			return;
		}
		const signedUrl = await context.dataManagementClient.createSignedUrl(bucketKey, objectKey, permissions);
		const action = await vscode.window.showInformationMessage(`Signed URL: ${signedUrl.signedUrl} (expires in ${signedUrl.expiration})`, 'Copy URL to Clipboard');
		if (action === 'Copy URL to Clipboard') {
			vscode.env.clipboard.writeText(signedUrl.signedUrl);
		}
	} catch(err) {
		showErrorMessage('Could not generate signed URL', err, context);
	}
}

async function deleteBucket(bucket: IBucket | undefined, context: IContext) {
	try {
		if (!bucket) {
			bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
		}

		const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete bucket: ${bucket.bucketKey}? This action cannot be undone.`, { modal: true }, 'Delete');
		if (confirm !== 'Delete') {
			return;
		}

		const { bucketKey } = bucket;
		await withProgress(`Deleting bucket: ${bucketKey}`, context.dataManagementClient.deleteBucket(bucketKey));
        vscode.window.showInformationMessage(`Bucket deleted: ${bucketKey}`);
    } catch(err) {
		showErrorMessage('Could not delete bucket', err, context);
    }
}
