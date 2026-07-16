import * as vscode from 'vscode';
import * as path from 'path';
import { BucketsItems, ObjectDetails } from '../models/oss';
import { createWebViewPanel, IContext, promptBucket, promptObject, showErrorMessage, withProgress } from '../common';

export class ObjectStorageServiceCommands {
    constructor(
        protected context: IContext,
        protected refresh: () => void,
        protected onLoadMore: (parentKey: string) => void,
        protected onGetFilter: (bucketKey: string) => string | undefined,
        protected onSetFilter: (bucketKey: string, prefix: string | undefined) => void
    ) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.oss.refreshBuckets', this.refreshBuckets.bind(this)),
            vscode.commands.registerCommand('aps.oss.loadMore', this.loadMore.bind(this)),
            vscode.commands.registerCommand('aps.oss.filterObjects', this.filterObjects.bind(this)),
            vscode.commands.registerCommand('aps.oss.clearObjectsFilter', this.clearObjectsFilter.bind(this)),
            vscode.commands.registerCommand('aps.oss.createBucket', this.createBucket.bind(this)),
            vscode.commands.registerCommand('aps.oss.viewBucketDetails', this.viewBucketDetails.bind(this)),
            vscode.commands.registerCommand('aps.oss.copyBucketKey', this.copyBucketKey.bind(this)),
            vscode.commands.registerCommand('aps.oss.deleteBucketObjects', this.deleteBucketObjects.bind(this)),
            vscode.commands.registerCommand('aps.oss.viewObjectDetails', this.viewObjectDetails.bind(this)),
            vscode.commands.registerCommand('aps.oss.copyObjectKey', this.copyObjectKey.bind(this)),
            vscode.commands.registerCommand('aps.oss.uploadObject', this.uploadObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.createEmptyObject', this.createEmptyObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.copyObject', this.copyObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.renameObject', this.renameObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.downloadObject', this.downloadObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.deleteObject', this.deleteObject.bind(this)),
            vscode.commands.registerCommand('aps.oss.generateSignedUrl', this.generateSignedUrl.bind(this)),
            vscode.commands.registerCommand('aps.oss.deleteBucket', this.deleteBucket.bind(this)),
        ];
    }

    async refreshBuckets() {
        this.refresh();
    }

    async loadMore(parentKey: string) {
        this.onLoadMore(parentKey);
    }

    async filterObjects(bucket?: BucketsItems) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const { bucketKey } = bucket;
            const prefix = await vscode.window.showInputBox({
                prompt: `Enter a key prefix to filter objects in bucket: ${bucketKey}`,
                placeHolder: 'e.g. folder/subfolder/',
                value: this.onGetFilter(bucketKey)
            });
            if (prefix === undefined) {
                return;
            }
            this.onSetFilter(bucketKey, prefix || undefined);
        } catch (err) {
            showErrorMessage('Could not filter objects', err, this.context);
        }
    }

    async clearObjectsFilter(bucket?: BucketsItems) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            this.onSetFilter(bucket.bucketKey, undefined);
        } catch (err) {
            showErrorMessage('Could not clear object filter', err, this.context);
        }
    }

    async createBucket() {
        const name = await vscode.window.showInputBox({ prompt: 'Enter unique bucket name' });
        if (!name) {
            return;
        }
        const retention = await vscode.window.showQuickPick(this.context.ossService.retentionPolicies, { placeHolder: 'Select retention policy' });
        if (!retention) {
            return;
        }

        try {
            const bucket = await withProgress(`Creating bucket: ${name}`, this.context.ossService.createBucket(this.context.environment.region as string, name, retention));
            vscode.window.showInformationMessage(`Bucket created: ${bucket.bucketKey}`);
        } catch (err) {
            showErrorMessage('Could not create bucket', err, this.context);
        }
        this.refresh();
    }

    async viewBucketDetails(bucket?: BucketsItems) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const { bucketKey } = bucket;
            const bucketDetails = await withProgress(`Getting bucket details: ${bucketKey}`, this.context.ossService.getBucketDetails(bucketKey));
            createWebViewPanel(this.context, 'bucket-details.js', 'bucket-details', `Bucket Details: ${bucketKey}`, { detail: bucketDetails });
            // const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(bucketDetails, null, 4), language: 'json' });
            // await vscode.window.showTextDocument(doc, { preview: false });
        } catch(err) {
            showErrorMessage('Could not access bucket', err, this.context);
        }
    }

    async copyBucketKey(bucket?: BucketsItems) {
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

    async deleteBucketObjects(bucket?: BucketsItems) {
        try {
            if (!bucket) {
                bucket = await promptBucket(this.context);
                if (!bucket) {
                    return;
                }
            }

            const { bucketKey } = bucket;
            const objects = await this.context.ossService.getAllObjects(bucketKey);
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
                progress.report({ increment: 0 });
                await this.context.ossService.deleteObjects(bucketKey, objects.map(object => object.objectKey!), {
                    onProgress: (increment) => progress.report({ increment }),
                    isCancelled: () => cancelled
                });
            });
            vscode.window.showInformationMessage(`Objects deleted`);
        } catch(err) {
            showErrorMessage('Could not delete objects', err, this.context);
        }
        this.refresh();
    }

    async viewObjectDetails(object?: ObjectDetails) {
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

            const objectKey = object.objectKey!, bucketKey = object.bucketKey!;
            const objectDetails = await withProgress(`Getting object details: ${objectKey}`, this.context.ossService.getObjectDetails(bucketKey, objectKey));
            createWebViewPanel(this.context, 'object-details.js', 'object-details', `Object Details: ${objectKey}`, { detail: objectDetails });
            // const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(objectDetails, null, 4), language: 'json' });
            // await vscode.window.showTextDocument(doc, { preview: false });
        } catch(err) {
            showErrorMessage('Could not access object', err, this.context);
        }
    }

    async copyObjectKey(object?: ObjectDetails) {
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

            await vscode.env.clipboard.writeText(object.objectKey!);
            vscode.window.showInformationMessage(`Object key copied to clipboard: ${object.objectKey}`);
        } catch (err) {
            showErrorMessage('Could not obtain object key', err, this.context);
        }
    }

    async uploadObject(bucket?: BucketsItems) {
        // TODO: re-introduce support for cancellable uploads
        async function _upload(name: string, uri: vscode.Uri, context: IContext, bucketKey: string, contentType?: string) {
            const filepath = uri.fsPath;
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Uploading file: ${filepath}`,
                    cancellable: false
                }, async (progress, token) => {
                    await context.ossService.uploadObject(bucketKey, name, filepath, {
                        contentType,
                        onProgress: (percentCompleted) => progress.report({ increment: percentCompleted })
                    });
                });
                const res = await vscode.window.showInformationMessage(`Upload complete: ${filepath}`, 'Translate', 'Translate (Custom)');
                if (res === 'Translate') {
                    const obj = await context.ossService.getObjectDetails(bucketKey, name);
                    vscode.commands.executeCommand('aps.md.translateObject', obj);
                } else if (res === 'Translate (Custom)') {
                    const obj = await context.ossService.getObjectDetails(bucketKey, name);
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
                contentType = await vscode.window.showQuickPick(this.context.ossService.contentTypes, { canPickMany: false, placeHolder: 'Select content type' });
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

    async createEmptyObject(bucket?: BucketsItems) {
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
            contentType = await vscode.window.showQuickPick(this.context.ossService.contentTypes, { canPickMany: false, placeHolder: 'Select content type' });
        }
        if (!contentType) {
            return;
        }

        try {
            const objectId = await this.context.ossService.createEmptyObject(bucketKey, name);
            vscode.window.showInformationMessage(`Object created: ${objectId}`);
        } catch(err) {
            showErrorMessage('Could not create file', err, this.context);
        }
        this.refresh();
    }

    async copyObject(object?: ObjectDetails) {
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

            const bucketKey = object.bucketKey!, objectKey = object.objectKey!;
            await withProgress(`Copying file: ${object.objectKey}`, this.context.ossService.copyObject(bucketKey, objectKey, newObjectKey));
            vscode.window.showInformationMessage(`Object copy created: ${newObjectKey}`);
        } catch(err) {
            showErrorMessage('Could not copy object', err, this.context);
        }
        this.refresh();
    }

    async renameObject(object?: ObjectDetails) {
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

            const bucketKey = object.bucketKey!, objectKey = object.objectKey!;
            await withProgress(`Renaming file: ${object.objectKey}`, this.context.ossService.renameObject(bucketKey, objectKey, newObjectKey));
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

    async downloadObject(object?: ObjectDetails) {
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
        const objectKey = object.objectKey!, bucketKey = object.bucketKey!;

        const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(objectKey) });
        if (!uri) {
            return;
        }

        try {
            await withProgress(`Downloading file: ${uri.fsPath}`, this.context.ossService.downloadObject(bucketKey, objectKey, uri.fsPath));
            const action = await vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`, 'Open File');
            if (action === 'Open File') {
                vscode.env.openExternal(uri);
            }
        } catch(err) {
            showErrorMessage('Could not download file', err, this.context);
        }
    }

    async deleteObject(object?: ObjectDetails) {
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

            const bucketKey = object.bucketKey!, objectKey = object.objectKey!;
            await withProgress(`Deleting object: ${object.objectKey}`, this.context.ossService.deleteObject(bucketKey, objectKey));
            vscode.window.showInformationMessage(`Object deleted: ${object.objectKey}`);
        } catch(err) {
            showErrorMessage('Could not delete object', err, this.context);
        }
        this.refresh();
    }

    async generateSignedUrl(object?: ObjectDetails) {
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
            const objectKey = object.objectKey!, bucketKey = object.bucketKey!;
            const permissions = await vscode.window.showQuickPick(['read', 'write', 'readwrite'], {
                canPickMany: false, placeHolder: 'Select access permissions for the new URL'
            });
            if (!permissions) {
                return;
            }
            const signedUrl = await this.context.ossService.createSignedUrl(bucketKey, objectKey, permissions as 'read' | 'write' | 'readwrite');
            const action = await vscode.window.showInformationMessage(`Signed URL: ${signedUrl.signedUrl} (expires in ${signedUrl.expiration})`, 'Copy URL to Clipboard');
            if (action === 'Copy URL to Clipboard') {
                vscode.env.clipboard.writeText(signedUrl.signedUrl);
            }
        } catch(err) {
            showErrorMessage('Could not generate signed URL', err, this.context);
        }
    }

    async deleteBucket(bucket?: BucketsItems) {
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
            await withProgress(`Deleting bucket: ${bucketKey}`, this.context.ossService.deleteBucket(bucketKey));
            vscode.window.showInformationMessage(`Bucket deleted: ${bucketKey}`);
        } catch(err) {
            showErrorMessage('Could not delete bucket', err, this.context);
        }
        this.refresh();
    }
}
