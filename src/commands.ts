import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
	IBucket,
	IObject,
	IResumableUploadRange,
	DataRetentionPolicy
} from 'forge-nodejs-utils';
import { idToUrn, IContext } from './common';
import { IDerivative } from './providers';

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

function computeFileHash(filename: string): Promise<string> {
    return new Promise(function(resolve, reject) {
        const stream = fs.createReadStream(filename);
        let hash = crypto.createHash('md5');
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
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating bucket: ${name}`,
			cancellable: false
		}, async (progress, token) => {
			const bucket = await context.dataManagementClient.createBucket(name, <DataRetentionPolicy>retention);
		});
        vscode.window.showInformationMessage(`Bucket created: ${name}`);
    } catch (err) {
		vscode.window.showErrorMessage(`Could not create bucket: ${JSON.stringify(err.message)}`);
    }
}

export async function viewBucketDetails(name: string, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting bucket details: ${name}`,
			cancellable: false
		}, async (progress, token) => {
			const bucketDetail = await context.dataManagementClient.getBucketDetails(name);
			const panel = vscode.window.createWebviewPanel(
				'bucket-details',
				`Details: ${bucketDetail.bucketKey}`,
				vscode.ViewColumn.One,
				{ enableScripts: false }
			);
			panel.webview.html = context.templateEngine.render('bucket-details', { bucket: bucketDetail });
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access bucket: ${JSON.stringify(err.message)}`);
	}
}

export async function uploadObject(bucket: IBucket, context: IContext) {
	// Collect inputs
    const uri = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
	if (!uri) {
		return;
	}
    const name = await vscode.window.showInputBox({ prompt: 'Enter object name', value: path.basename(uri[0].path) });
    if (!name) {
		return;
	}
    const contentType = await vscode.window.showQuickPick(Object.values(AllowedMimeTypes), { canPickMany: false, placeHolder: 'Select content type' });
    if (!contentType) {
		return;
	}

	const filepath = uri[0].path;
	let fd = -1;
    try {
		fd = fs.openSync(filepath, 'r');
		const totalBytes = fs.statSync(filepath).size;
		const chunkBytes = 2 << 20; // TODO: make the page size configurable
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
			const fileContentHash = await computeFileHash(filepath);
			let ranges: IResumableUploadRange[];
			try {
				ranges = await context.dataManagementClient.getResumableUploadStatus(bucket.bucketKey, name, fileContentHash);
			} catch(err) {
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
					await context.dataManagementClient.uploadObjectResumable(bucket.bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, fileContentHash, contentType);
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
				await context.dataManagementClient.uploadObjectResumable(bucket.bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, fileContentHash, contentType);
				progress.report({ increment: 100 * chunkSize / totalBytes });
				lastByte += chunkSize;
			}
		});

		if (cancelled) {
			vscode.window.showInformationMessage(`Upload cancelled: ${filepath}`);
		} else {
			vscode.window.showInformationMessage(`Upload complete: ${filepath}`);
		}
    } catch(err) {
		vscode.window.showErrorMessage(`Could not upload file: ${JSON.stringify(err.message)}`);
	} finally {
		if (fd !== -1) {
			fs.closeSync(fd);
			fd = -1;
		}
	}
}

export async function downloadObject(bucketKey: string, objectKey: string, context: IContext) {
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(objectKey) });
    if (!uri) {
		return;
	}

    try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Downloading file: ${uri.fsPath}`,
			cancellable: false
		}, async (progress, token) => {
			const arrayBuffer = await context.dataManagementClient.downloadObject(bucketKey, objectKey);
			fs.writeFileSync(uri.fsPath, Buffer.from(arrayBuffer), { encoding: 'binary' });
		});
        vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`);
    } catch(err) {
        vscode.window.showErrorMessage(`Could not download file: ${JSON.stringify(err.message)}`);
    }
}

export async function translateObject(object: IObject, context: IContext) {
    try {
		const urn = idToUrn(object.objectId);
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

export async function previewDerivative(derivative: IDerivative, context: IContext) {
	try {
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

export async function viewDerivativeTree(derivative: IDerivative, context: IContext) {
	try {
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

export async function viewDerivativeProps(derivative: IDerivative, context: IContext) {
	try {
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

export async function viewObjectDetails(object: IObject, context: IContext) {
	try {
		const panel = vscode.window.createWebviewPanel(
			'object-details',
			'Details: ' + object.objectKey,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		panel.webview.html = context.templateEngine.render('object-details', { object });
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access object: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteObject(object: IObject, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Deleting object: ${object.objectKey}`,
			cancellable: false
		}, async (progress, token) => {
			await context.dataManagementClient.deleteObject(object.bucketKey, object.objectKey);
		});
        vscode.window.showInformationMessage(`Object deleted: ${object.objectKey}`);
    } catch(err) {
        vscode.window.showErrorMessage(`Could not delete object: ${JSON.stringify(err.message)}`);
    }
}

type FullyQualifiedID = string;
type UnqualifiedID = string;
interface INameAndVersion {
	name: string;
	version: number;
}

export async function viewAppBundleDetails(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting appbundle details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const appBundleDetail = typeof(id) === 'string'
				? await context.designAutomationClient.getAppBundle(id)
				: await context.designAutomationClient.getAppBundleVersion(id.name, id.version);
			const panel = vscode.window.createWebviewPanel(
				'appbundle-details',
				`Details: ${appBundleDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			panel.webview.html = context.templateEngine.render('appbundle-details', { bundle: appBundleDetail });
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function viewActivityDetails(id: FullyQualifiedID | INameAndVersion, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting activity details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const activityDetail = typeof(id) === 'string'
				? await context.designAutomationClient.getActivity(id)
				: await context.designAutomationClient.getActivityVersion(id.name, id.version);
			const panel = vscode.window.createWebviewPanel(
				'activity-details',
				`Details: ${activityDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			panel.webview.html = context.templateEngine.render('activity-details', { activity: activityDetail });
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundle(id: UnqualifiedID, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing appbundle: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundle(id);
		});
		vscode.window.showInformationMessage(`Appbundle removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function createAppBundleAlias(id: UnqualifiedID, context: IContext) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const appBundleVersions = await context.designAutomationClient.listAppBundleVersions(id);
		const appBundleVersion = await vscode.window.showQuickPick(appBundleVersions.map(v => v.toString()), {
			canPickMany: false, placeHolder: 'Select appbundle version'
		});
		if (!appBundleVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const appBundleVersions = await context.designAutomationClient.listAppBundleVersions(id);
		const appBundleVersion = await vscode.window.showQuickPick(appBundleVersions.map(v => v.toString()), {
			canPickMany: false, placeHolder: 'Select appbundle version'
		});
		if (!appBundleVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating appbundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundleAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Appbundle alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteAppBundleVersion(id, version);
		});
		vscode.window.showInformationMessage(`Appbundle version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle version: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivity(id: UnqualifiedID, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivity(id);
		});
		vscode.window.showInformationMessage(`Activity removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivityAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Activity alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityVersion(id: UnqualifiedID, version: number, context: IContext) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.deleteActivityVersion(id, version);
		});
		vscode.window.showInformationMessage(`Activity version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity version: ${JSON.stringify(err.message)}`);
	}
}

export async function createActivityAlias(id: UnqualifiedID, context: IContext) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const activityVersions = await context.designAutomationClient.listActivityVersions(id);
		const activityVersion = await vscode.window.showQuickPick(activityVersions.map(v => v.toString()), {
			canPickMany: false, placeHolder: 'Select activity version'
		});
		if (!activityVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.createActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateActivityAlias(id: UnqualifiedID, alias: string, context: IContext) {
	try {
		const activityVersions = await context.designAutomationClient.listActivityVersions(id);
		const activityVersion = await vscode.window.showQuickPick(activityVersions.map(v => v.toString()), {
			canPickMany: false, placeHolder: 'Select activity version'
		});
		if (!activityVersion) {
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await context.designAutomationClient.updateActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update activity alias: ${JSON.stringify(err.message)}`);
	}
}
