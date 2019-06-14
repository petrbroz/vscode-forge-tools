import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import {
	AuthenticationClient,
	DataManagementClient,
	IBucket,
	IObject,
	ModelDerivativeClient
} from 'forge-nodejs-utils';

const RetentionPolicyKeys = ['transient', 'temporary', 'permanent'];
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

export async function createBucket(client: DataManagementClient) {
    const name = await vscode.window.showInputBox({ prompt: 'Enter unique bucket name' });
    if (!name)
        return;

    const retention = await vscode.window.showQuickPick(RetentionPolicyKeys, { placeHolder: 'Select retention policy' });
    if (!retention)
        return;

    try {
        const bucket = await client.createBucket(name, retention);
        vscode.window.showInformationMessage('Bucket created: ' + bucket.bucketKey);
    } catch (err) {
        vscode.window.showErrorMessage('Could not create bucket: ' + JSON.stringify(err));
    }
}

export async function uploadObject(bucket: IBucket, client: DataManagementClient) {
    const uri = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
    if (!uri)
        return;

    const name = await vscode.window.showInputBox({ prompt: 'Enter object name', value: path.basename(uri[0].path) });
    if (!name)
        return;

    const contentType = await vscode.window.showQuickPick(Object.values(AllowedMimeTypes), { canPickMany: false, placeHolder: 'Select content type' });
    if (!contentType)
        return;

    const buff = fs.readFileSync(uri[0].path);
    try {
		const result = await client.uploadObject(bucket.bucketKey, name, contentType, buff);
        vscode.window.showInformationMessage('Uploaded file: ' + JSON.stringify(result));
    } catch(err) {
        vscode.window.showErrorMessage('Could not upload file: ' + JSON.stringify(err));
    }
}

export async function downloadObject(bucketKey: string, objectKey: string, client: DataManagementClient) {
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(objectKey) });
    if (!uri)
        return;

    try {
        const arrayBuffer = await client.downloadObject(bucketKey, objectKey);
        fs.writeFileSync(uri.fsPath, Buffer.from(arrayBuffer), { encoding: 'binary' });
        vscode.window.showInformationMessage('Downloaded file: ' + uri.fsPath);
    } catch(err) {
        vscode.window.showErrorMessage('Could not download file: ' + JSON.stringify(err));
    }
}

let _templateFuncCache: Map<string, ejs.TemplateFunction> = new Map();

export async function previewObject(object: IObject, context: vscode.ExtensionContext, authClient: AuthenticationClient, derivClient: ModelDerivativeClient) {
	if (!_templateFuncCache.has('object-preview')) {
		const templatePath = context.asAbsolutePath(path.join('resources', 'templates', 'object-preview.ejs'));
		const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
		_templateFuncCache.set('object-preview', ejs.compile(template));
	}

	const token = await authClient.authenticate(['viewables:read']);
	const panel = vscode.window.createWebviewPanel(
		'object-preview',
		'Preview: ' + object.objectKey,
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);
	const templateFunc = _templateFuncCache.get('object-preview');
	if (templateFunc) {
		panel.webview.html = templateFunc({ object, token });
	}

	panel.webview.onDidReceiveMessage(
		async (message) => {
			switch (message.command) {
				case 'translate':
					const job = await derivClient.submitJob(message.urn, [{ type: 'svf', views: ['2d', '3d'] }]);
					vscode.window.showInformationMessage('Started translation job: ' + JSON.stringify(job));
					let manifest = await derivClient.getManifest(message.urn);
					while (manifest.status === 'inprogress' || manifest.status === 'pending') {
						panel.webview.postMessage({ command: 'progress', progress: manifest.progress });
						await sleep(2000);
						manifest = await derivClient.getManifest(message.urn);
					}
					panel.webview.postMessage({ command: 'reload' });
					return;
			}
		},
		undefined,
		context.subscriptions
	);
}