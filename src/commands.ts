import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as ejs from 'ejs';
import {
	AuthenticationClient,
	ModelDerivativeClient,
	DesignAutomationClient,
	DataManagementClient,
	IBucket,
	IObject,
	IResumableUploadRange,
	DataRetentionPolicy,
	IJob
} from 'forge-nodejs-utils';
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export async function createBucket(client: DataManagementClient) {
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
			const bucket = await client.createBucket(name, <DataRetentionPolicy>retention);
		});
        vscode.window.showInformationMessage(`Bucket created: ${name}`);
    } catch (err) {
		vscode.window.showErrorMessage(`Could not create bucket: ${JSON.stringify(err.message)}`);
    }
}

export async function viewBucketDetails(name: string, context: vscode.ExtensionContext, client: DataManagementClient) {
	if (!_templateFuncCache.has('bucket-details')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'bucket-details.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('bucket-details', ejs.compile(template));
	}

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting bucket details: ${name}`,
			cancellable: false
		}, async (progress, token) => {
			const bucketDetail = await client.getBucketDetails(name);
			const panel = vscode.window.createWebviewPanel(
				'bucket-details',
				`Details: ${bucketDetail.bucketKey}`,
				vscode.ViewColumn.One,
				{ enableScripts: false }
			);
			const templateFunc = _templateFuncCache.get('bucket-details');
			if (templateFunc) {
				panel.webview.html = templateFunc({ bucket: bucketDetail });
			}
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access bucket: ${JSON.stringify(err.message)}`);
	}
}

export async function uploadObject(bucket: IBucket, client: DataManagementClient) {
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
				ranges = await client.getResumableUploadStatus(bucket.bucketKey, name, fileContentHash);
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
					await client.uploadObjectResumable(bucket.bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, fileContentHash, contentType);
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
				await client.uploadObjectResumable(bucket.bucketKey, name, buff.slice(0, chunkSize), lastByte, totalBytes, fileContentHash, contentType);
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

export async function downloadObject(bucketKey: string, objectKey: string, client: DataManagementClient) {
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
			const arrayBuffer = await client.downloadObject(bucketKey, objectKey);
			fs.writeFileSync(uri.fsPath, Buffer.from(arrayBuffer), { encoding: 'binary' });
		});
        vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`);
    } catch(err) {
        vscode.window.showErrorMessage(`Could not download file: ${JSON.stringify(err.message)}`);
    }
}

let _templateFuncCache: Map<string, ejs.TemplateFunction> = new Map();

export async function previewObject(derivative: IDerivative, context: vscode.ExtensionContext, authClient: AuthenticationClient, derivClient: ModelDerivativeClient) {
	if (!_templateFuncCache.has('object-preview')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'object-preview.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('object-preview', ejs.compile(template));
	}

	try {
		const token = await authClient.authenticate(['viewables:read']);
		const panel = vscode.window.createWebviewPanel(
			'object-preview',
			'Preview: ' + derivative.name,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		const templateFunc = _templateFuncCache.get('object-preview');
		if (templateFunc) {
			panel.webview.html = templateFunc({ urn: derivative.urn, guid: derivative.guid, name: derivative.name, token });
		}

		// panel.webview.onDidReceiveMessage(
		// 	async (message) => {
		// 		switch (message.command) {
		// 			case 'translate':
		// 				try {
		// 					await vscode.window.withProgress({
		// 						location: vscode.ProgressLocation.Notification,
		// 						title: `Translating object: ${message.urn}`,
		// 						cancellable: false
		// 					}, async (progress, token) => {
		// 						let job: IJob;
		// 						if (message.compressed && message.rootfile) {
		// 							job = await derivClient.submitJob(message.urn, [{ type: 'svf', views: ['2d', '3d'] }], message.rootfile);
		// 						} else {
		// 							job = await derivClient.submitJob(message.urn, [{ type: 'svf', views: ['2d', '3d'] }]);
		// 						}
		// 						progress.report({ message: `Translation started: ${job.urn}` });
		// 						let manifest = await derivClient.getManifest(message.urn);
		// 						while (manifest.status === 'inprogress' || manifest.status === 'pending') {
		// 							progress.report({ message: manifest.progress });
		// 							panel.webview.postMessage({ command: 'progress', progress: manifest.progress });
		// 							await sleep(2000);
		// 							manifest = await derivClient.getManifest(message.urn);
		// 						}
		// 					});
		// 					panel.webview.postMessage({ command: 'reload' });
		// 				} catch(err) {
		// 					vscode.window.showErrorMessage(`Could not translate file: ${JSON.stringify(err.message)}`);
		// 				}
		// 		}
		// 	},
		// 	undefined,
		// 	context.subscriptions
		// );
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access object: ${JSON.stringify(err.message)}`);
	}
}

export async function viewObjectDetails(object: IObject, context: vscode.ExtensionContext) {
	if (!_templateFuncCache.has('object-details')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'object-details.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('object-details', ejs.compile(template));
	}

	try {
		const panel = vscode.window.createWebviewPanel(
			'object-details',
			'Details: ' + object.objectKey,
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);
		const templateFunc = _templateFuncCache.get('object-details');
		if (templateFunc) {
			panel.webview.html = templateFunc({ object });
		}
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access object: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteObject(object: IObject, context: vscode.ExtensionContext, client: DataManagementClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Deleting object: ${object.objectKey}`,
			cancellable: false
		}, async (progress, token) => {
			await client.deleteObject(object.bucketKey, object.objectKey);
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

export async function viewAppBundleDetails(id: FullyQualifiedID | INameAndVersion, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	if (!_templateFuncCache.has('appbundle-details')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'appbundle-details.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('appbundle-details', ejs.compile(template));
	}

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting appbundle details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const appBundleDetail = typeof(id) === 'string'
				? await designAutomationClient.getAppBundle(id)
				: await designAutomationClient.getAppBundleVersion(id.name, id.version);
			const panel = vscode.window.createWebviewPanel(
				'appbundle-details',
				`Details: ${appBundleDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			const templateFunc = _templateFuncCache.get('appbundle-details');
			if (templateFunc) {
				panel.webview.html = templateFunc({ bundle: appBundleDetail });
			}
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function viewActivityDetails(id: FullyQualifiedID | INameAndVersion, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	if (!_templateFuncCache.has('activity-details')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'activity-details.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('activity-details', ejs.compile(template));
	}

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Getting activity details: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			const activityDetail = typeof(id) === 'string'
				? await designAutomationClient.getActivity(id)
				: await designAutomationClient.getActivityVersion(id.name, id.version);
			const panel = vscode.window.createWebviewPanel(
				'activity-details',
				`Details: ${activityDetail.id}`,
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			const templateFunc = _templateFuncCache.get('activity-details');
			if (templateFunc) {
				panel.webview.html = templateFunc({ activity: activityDetail });
			}
		});
	} catch(err) {
		vscode.window.showErrorMessage(`Could not access activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundle(id: UnqualifiedID, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing appbundle: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteAppBundle(id);
		});
		vscode.window.showInformationMessage(`Appbundle removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle: ${JSON.stringify(err.message)}`);
	}
}

export async function createAppBundleAlias(id: UnqualifiedID, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const appBundleVersions = await designAutomationClient.listAppBundleVersions(id);
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
			await designAutomationClient.createAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateAppBundleAlias(id: UnqualifiedID, alias: string, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		const appBundleVersions = await designAutomationClient.listAppBundleVersions(id);
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
			await designAutomationClient.updateAppBundleAlias(id, alias, parseInt(appBundleVersion));
		});
		vscode.window.showInformationMessage(`Appbundle alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleAlias(id: UnqualifiedID, alias: string, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteAppBundleAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Appbundle alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteAppBundleVersion(id: UnqualifiedID, version: number, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing app bundle version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteAppBundleVersion(id, version);
		});
		vscode.window.showInformationMessage(`Appbundle version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove appbundle version: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivity(id: UnqualifiedID, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity: ${id}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteActivity(id);
		});
		vscode.window.showInformationMessage(`Activity removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityAlias(id: UnqualifiedID, alias: string, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity alias: ${id}/${alias}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteActivityAlias(id, alias);
		});
		vscode.window.showInformationMessage(`Activity alias removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function deleteActivityVersion(id: UnqualifiedID, version: number, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Removing activity version: ${id}/${version}`,
			cancellable: false
		}, async (progress, token) => {
			await designAutomationClient.deleteActivityVersion(id, version);
		});
		vscode.window.showInformationMessage(`Activity version removed`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not remove activity version: ${JSON.stringify(err.message)}`);
	}
}

export async function createActivityAlias(id: UnqualifiedID, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		const alias = await vscode.window.showInputBox({ prompt: 'Enter alias name' });
		if (!alias) {
			return;
		}
		const activityVersions = await designAutomationClient.listActivityVersions(id);
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
			await designAutomationClient.createActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias created`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not create activity alias: ${JSON.stringify(err.message)}`);
	}
}

export async function updateActivityAlias(id: UnqualifiedID, alias: string, context: vscode.ExtensionContext, designAutomationClient: DesignAutomationClient) {
	try {
		const activityVersions = await designAutomationClient.listActivityVersions(id);
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
			await designAutomationClient.updateActivityAlias(id, alias, parseInt(activityVersion));
		});
		vscode.window.showInformationMessage(`Activity alias updated`);
	} catch(err) {
		vscode.window.showErrorMessage(`Could not update activity alias: ${JSON.stringify(err.message)}`);
	}
}
