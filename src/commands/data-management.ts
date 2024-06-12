import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import {
	IBucket,
	IObject,
	IResumableUploadRange,
	DataRetentionPolicy
} from 'aps-sdk-node';
import { IContext, promptBucket, promptObject, showErrorMessage } from '../common';
import { withProgress, createWebViewPanel } from '../common';

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

function computeFileHash(bucketKey: string, objectKey: string, filename: string): Promise<string> {
    return new Promise(function(resolve, reject) {
        const stream = fs.createReadStream(filename);
		let hash = crypto.createHash('md5');
		hash.update(bucketKey);
		hash.update(objectKey);
        stream.on('data', function(chunk) {
            hash.update(chunk);
        });
        stream.on('end', function() {
            resolve(hash.digest('hex'));
        });
        stream.on('error', function(err) {
            reject(err);
        });
    });
}

export async function createBucket(context: IContext) {
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
		showErrorMessage('Could not create bucket', err);
    }
}

export async function viewBucketDetails(bucket: IBucket | undefined, context: IContext) {
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
		showErrorMessage('Could not access bucket', err);
	}
}

export async function copyBucketKey(bucket: IBucket | undefined, context: IContext) {
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
		showErrorMessage('Could not obtain bucket key', err);
	}
}

export async function uploadObject(bucket: IBucket | undefined, context: IContext) {
	const chunkBytes = vscode.workspace.getConfiguration(undefined, null).get<number>('autodesk.forge.data.uploadChunkSize') || (2 << 20);

	async function _upload(name: string, uri: vscode.Uri, context: IContext, bucketKey: string, contentType?: string) {
		const filepath = uri.fsPath;
		const hash = await computeFileHash(bucketKey, name, filepath);
		const stateKey = `upload:${hash}`;
		let fd = -1;
		try {
			fd = fs.openSync(filepath, 'r');
			const totalBytes = fs.statSync(filepath).size;
			const buff = Buffer.alloc(chunkBytes);
			let lastByte = 0;
			let cancelled = false;
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Uploading file: ${filepath}`,
				cancellable: true
			}, async (progress, token) => {
				token.onCancellationRequested(() => {
					cancelled = true;
				});
				progress.report({ increment: 0 });

				// Check if any parts of the file have already been uploaded
				let uploadSessionID = context.extensionContext.globalState.get<string>(stateKey);
				if (!uploadSessionID) {
					uploadSessionID = crypto.randomBytes(8).toString('hex');
					context.extensionContext.globalState.update(stateKey, uploadSessionID);
				}
				let ranges: IResumableUploadRange[];
				try {
					ranges = await context.dataManagementClient.getResumableUploadStatus(bucketKey, name, uploadSessionID);
				} catch (err) {
					ranges = [];
				}

				// Upload potential missing data before each successfully uploaded range
				for (const range of ranges) {
					if (cancelled) {
						return;
					}
					while (lastByte < range.start) {
						if (cancelled) {
							return;
						}
						const chunkSize = Math.min(range.start - lastByte, chunkBytes);
						fs.readSync(fd, buff, 0, chunkSize, lastByte);
						await context.dataManagementClient.uploadObjectResumable(bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, uploadSessionID, contentType);
						progress.report({ increment: 100 * chunkSize / totalBytes });
						lastByte += chunkSize;
					}
					progress.report({ increment: 100 * (range.end + 1 - lastByte) / totalBytes });
					lastByte = range.end + 1;
				}
	
				// Upload potential missing data after the last successfully uploaded range
				while (lastByte < totalBytes - 1) {
					if (cancelled) {
						return;
					}
					const chunkSize = Math.min(totalBytes - lastByte, chunkBytes);
					fs.readSync(fd, buff, 0, chunkSize, lastByte);
					await context.dataManagementClient.uploadObjectResumable(bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, uploadSessionID, contentType);
					progress.report({ increment: 100 * chunkSize / totalBytes });
					lastByte += chunkSize;
				}
			});

			if (cancelled) {
				vscode.window.showInformationMessage(`Upload cancelled: ${filepath}`);
			} else {
				// Clear the resumable upload session info
				context.extensionContext.globalState.update(stateKey, null);
				const res = await vscode.window.showInformationMessage(`Upload complete: ${filepath}`, 'Translate', 'Translate (Custom)');
				if (res === 'Translate') {
					const obj = await context.dataManagementClient.getObjectDetails(bucketKey, name);
					vscode.commands.executeCommand('forge.translateObject', obj);
				} else if (res === 'Translate (Custom)') {
					const obj = await context.dataManagementClient.getObjectDetails(bucketKey, name);
					vscode.commands.executeCommand('forge.translateObjectCustom', obj);
				}
			}
		} catch (err) {
			showErrorMessage('Could not upload file', err);
		} finally {
			if (fd !== -1) {
				fs.closeSync(fd);
				fd = -1;
			}
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
		}
		if (!contentType) {
			return;
		}

		await _upload(name, uris[0], context, bucketKey, contentType);
	} else {
		const uploads = uris.map(uri => _upload(path.basename(uri.fsPath), uri, context, bucketKey));
		await Promise.all(uploads);
	}
}

export async function createEmptyObject(bucket: IBucket | undefined, context: IContext) {
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
		showErrorMessage('Could not create file', err);
	}
}

export async function downloadObject(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not download file', err);
    }
}

export async function viewObjectDetails(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not access object', err);
	}
}

export async function copyObjectKey(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not obtain object key', err);
	}
}

export async function copyObject(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not copy object', err);
	}
}

export async function renameObject(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not rename object', err);
	}
}

export async function deleteObject(object: IObject | undefined, context: IContext) {
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
		const { bucketKey, objectKey } = object;
		await withProgress(`Deleting object: ${object.objectKey}`, context.dataManagementClient.deleteObject(bucketKey, objectKey));
        vscode.window.showInformationMessage(`Object deleted: ${object.objectKey}`);
    } catch(err) {
		showErrorMessage('Could not delete object', err);
    }
}

export async function deleteAllObjects(bucket: IBucket | undefined, context: IContext) {
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
		showErrorMessage('Could not delete objects', err);
    }
}

export async function generateSignedUrl(object: IObject | undefined, context: IContext) {
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
		showErrorMessage('Could not generate signed URL', err);
	}
}

export async function deleteBucket(bucket: IBucket | undefined, context: IContext) {
	try {
		if (!bucket) {
			bucket = await promptBucket(context);
			if (!bucket) {
				return;
			}
		}
		const { bucketKey } = bucket;
		await withProgress(`Deleting bucket: ${bucketKey}`, context.dataManagementClient.deleteBucket(bucketKey));
        vscode.window.showInformationMessage(`Bucket deleted: ${bucketKey}`);
    } catch(err) {
		showErrorMessage('Could not delete bucket', err);
    }
}