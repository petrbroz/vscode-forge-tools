import axios from 'axios';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IBucket, IObject, DataRetentionPolicy } from 'aps-sdk-node';
import { createWebViewPanel, IContext, promptBucket, promptObject, showErrorMessage, withProgress } from '../common';
import { CommandCategory, Command, CommandRegistry, ViewTitleMenu, ViewItemContextMenu } from './shared';

const RetentionPolicyKeys = ['transient', 'temporary', 'persistent'];
const DeleteBatchSize = 8;
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

@CommandCategory({ category: 'Autodesk Platform Services > Object Storage Service', prefix: 'aps.oss' })
export class ObjectStorageServiceCommands extends CommandRegistry {
    constructor(protected context: IContext, protected refresh: () => void) {
        super();
    }

    @Command({ title: 'Refresh Buckets', icon: 'refresh' })
    @ViewTitleMenu({ when: 'view == apsDataManagementView', group: 'navigation' })
    async refreshBuckets() {
        this.refresh();
    }

    @Command({ title: 'Create Bucket', icon: 'add' })
    @ViewTitleMenu({ when: 'view == apsDataManagementView', group: 'navigation' })
    async createBucket() {
        const name = await vscode.window.showInputBox({ prompt: 'Enter unique bucket name' });
        if (!name) {
            return;
        }
        const retention = await vscode.window.showQuickPick(RetentionPolicyKeys, { placeHolder: 'Select retention policy' });
        if (!retention) {
            return;
        }

        try {
            const bucket = await withProgress(`Creating bucket: ${name}`, this.context.dataManagementClient.createBucket(name, <DataRetentionPolicy>retention));
            vscode.window.showInformationMessage(`Bucket created: ${bucket.bucketKey}`);
        } catch (err) {
            showErrorMessage('Could not create bucket', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'View Bucket Details', icon: 'eye' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '0_view@1' })
    async viewBucketDetails(bucket?: IBucket) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const { bucketKey } = bucket;
            const bucketDetails = await withProgress(`Getting bucket details: ${bucketKey}`, this.context.dataManagementClient.getBucketDetails(bucketKey));
            createWebViewPanel(this.context, 'bucket-details.js', 'bucket-details', `Bucket Details: ${bucketKey}`, { detail: bucketDetails });
            // const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(bucketDetails, null, 4), language: 'json' });
            // await vscode.window.showTextDocument(doc, { preview: false });
        } catch(err) {
            showErrorMessage('Could not access bucket', err, this.context);
        }
    }

    @Command({ title: 'Copy Bucket Key to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '0_view@2' })
    async copyBucketKey(bucket?: IBucket) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            await vscode.env.clipboard.writeText(bucket.bucketKey);
            vscode.window.showInformationMessage(`Bucket key copied to clipboard: ${bucket.bucketKey}`);
        } catch (err) {
            showErrorMessage('Could not obtain bucket key', err, this.context);
        }
    }

    @Command({ title: 'Delete All Objects', icon: 'trash' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '3_remove@1' })
    async deleteBucketObjects(bucket?: IBucket) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const { bucketKey } = bucket;
            const objects = await this.context.dataManagementClient.listObjects(bucketKey);
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
                    batch.push(this.context.dataManagementClient.deleteObject(bucketKey, objects[i].objectKey));
                    if (batch.length === DeleteBatchSize || i === len - 1) {
                        await Promise.all(batch);
                        progress.report({ increment: 100.0 * batch.length / len });
                        batch = [];
                    }
                }
            });
            vscode.window.showInformationMessage(`Objects deleted`);
        } catch(err) {
            showErrorMessage('Could not delete objects', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'View Object Details', icon: 'eye' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '0_view@1' })
    async viewObjectDetails(object?: IObject) {
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

            const { objectKey, bucketKey } = object;
            const objectDetails = await withProgress(`Getting object details: ${objectKey}`, this.context.dataManagementClient.getObjectDetails(bucketKey, objectKey));
            createWebViewPanel(this.context, 'object-details.js', 'object-details', `Object Details: ${objectKey}`, { detail: objectDetails });
            // const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(objectDetails, null, 4), language: 'json' });
            // await vscode.window.showTextDocument(doc, { preview: false });
        } catch(err) {
            showErrorMessage('Could not access object', err, this.context);
        }
    }

    @Command({ title: 'Copy Object Key to Clipboard', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '0_view@2' })
    async copyObjectKey(object?: IObject) {
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

            await vscode.env.clipboard.writeText(object.objectKey);
            vscode.window.showInformationMessage(`Object key copied to clipboard: ${object.objectKey}`);
        } catch (err) {
            showErrorMessage('Could not obtain object key', err, this.context);
        }
    }

    @Command({ title: 'Upload Object', icon: 'cloud-upload' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '1_action@1' })
    async uploadObject(bucket?: IBucket) {
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
                    vscode.commands.executeCommand('aps.md.translateObject', obj);
                } else if (res === 'Translate (Custom)') {
                    const obj = await context.dataManagementClient.getObjectDetails(bucketKey, name);
                    vscode.commands.executeCommand('aps.md.translateObjectCustom', obj);
                }
            } catch (err) {
                showErrorMessage('Could not upload file', err, context);
            }
        }

        if (!bucket) {
            bucket = await promptBucket(this.context);
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
            await _upload(name, uris[0], this.context, bucketKey, contentType);
        } else {
            const uploads = uris.map(uri => _upload(path.basename(uri.fsPath), uri, this.context, bucketKey));
            await Promise.all(uploads);
        }
        this.refresh();
    }

    @Command({ title: 'Create Empty Object', icon: 'new-file' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '1_action@2' })
    async createEmptyObject(bucket?: IBucket) {
        if (!bucket) {
            bucket = await promptBucket(this.context);
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
            const signedUrl = await this.context.dataManagementClient.createSignedUrl(bucketKey, name, "write");
            const { data } = await axios.put(signedUrl.signedUrl, Buffer.from([]));
            vscode.window.showInformationMessage(`Object created: ${data.objectId}`);
        } catch(err) {
            showErrorMessage('Could not create file', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'Copy Object', icon: 'copy' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action@3' })
    async copyObject(object?: IObject) {
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
            const newObjectKey = await vscode.window.showInputBox({ prompt: 'Enter new object name' });
            if (!newObjectKey) {
                return;
            }

            const { bucketKey, objectKey } = object;
            await withProgress(`Copying file: ${object.objectKey}`, this.context.dataManagementClient.copyObject(bucketKey, objectKey, newObjectKey));
            vscode.window.showInformationMessage(`Object copy created: ${newObjectKey}`);
        } catch(err) {
            showErrorMessage('Could not copy object', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'Rename Object', icon: 'edit' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action@2' })
    async renameObject(object?: IObject) {
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
            const newObjectKey = await vscode.window.showInputBox({ prompt: 'Enter new object name' });
            if (!newObjectKey) {
                return;
            }

            const { bucketKey, objectKey } = object;
            await withProgress(`Renaming file: ${object.objectKey}`, this.context.dataManagementClient.copyObject(bucketKey, objectKey, newObjectKey));
            await withProgress(`Renaming file: ${object.objectKey}`, this.context.dataManagementClient.deleteObject(bucketKey, objectKey));
            vscode.window.showInformationMessage(`
                Object successfully renamed to ${newObjectKey}. Note that any derivatives created for
                the object's original name will not be accesible now but they still exist. You can
                either start another conversion job for this object with its new name, or rename
                the object back to ${object.objectKey} to regain access to the derivatives.
            `);
        } catch(err) {
            showErrorMessage('Could not rename object', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'Download Object', icon: 'cloud-download' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action@1' })
    async downloadObject(object?: IObject) {
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
        const { objectKey, bucketKey } = object;

        const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(objectKey) });
        if (!uri) {
            return;
        }

        try {
            const arrayBuffer = await withProgress(`Downloading file: ${uri.fsPath}`, this.context.dataManagementClient.downloadObject(bucketKey, objectKey));
            fs.writeFileSync(uri.fsPath, Buffer.from(arrayBuffer), { encoding: 'binary' });
            const action = await vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`, 'Open File');
            if (action === 'Open File') {
                vscode.env.openExternal(uri);
            }
        } catch(err) {
            showErrorMessage('Could not download file', err, this.context);
        }
    }

    @Command({ title: 'Delete Object', icon: 'trash' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '3_remove@1' })
    async deleteObject(object?: IObject) {
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

            const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete object: ${object.objectKey}? This action cannot be undone.`, { modal: true }, 'Delete');
            if (confirm !== 'Delete') {
                return;
            }

            const { bucketKey, objectKey } = object;
            await withProgress(`Deleting object: ${object.objectKey}`, this.context.dataManagementClient.deleteObject(bucketKey, objectKey));
            vscode.window.showInformationMessage(`Object deleted: ${object.objectKey}`);
        } catch(err) {
            showErrorMessage('Could not delete object', err, this.context);
        }
        this.refresh();
    }

    @Command({ title: 'Generate Signed URL', icon: 'link' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == object', group: '1_action@4' })
    async generateSignedUrl(object?: IObject) {
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
            const { objectKey, bucketKey } = object;
            const permissions = await vscode.window.showQuickPick(['read', 'write', 'readwrite'], {
                canPickMany: false, placeHolder: 'Select access permissions for the new URL'
            });
            if (!permissions) {
                return;
            }
            const signedUrl = await this.context.dataManagementClient.createSignedUrl(bucketKey, objectKey, permissions);
            const action = await vscode.window.showInformationMessage(`Signed URL: ${signedUrl.signedUrl} (expires in ${signedUrl.expiration})`, 'Copy URL to Clipboard');
            if (action === 'Copy URL to Clipboard') {
                vscode.env.clipboard.writeText(signedUrl.signedUrl);
            }
        } catch(err) {
            showErrorMessage('Could not generate signed URL', err, this.context);
        }
    }

    @Command({ title: 'Delete Bucket', icon: 'trash' })
    @ViewItemContextMenu({ when: 'view == apsDataManagementView && viewItem == bucket', group: '3_remove@2' })
    async deleteBucket(bucket?: IBucket) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete bucket: ${bucket.bucketKey}? This action cannot be undone.`, { modal: true }, 'Delete');
            if (confirm !== 'Delete') {
                return;
            }

            const { bucketKey } = bucket;
            await withProgress(`Deleting bucket: ${bucketKey}`, this.context.dataManagementClient.deleteBucket(bucketKey));
            vscode.window.showInformationMessage(`Bucket deleted: ${bucketKey}`);
        } catch(err) {
            showErrorMessage('Could not delete bucket', err, this.context);
        }
        this.refresh();
    }
}
