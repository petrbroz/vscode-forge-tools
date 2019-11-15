const vscode = acquireVsCodeApi();

$('body > figure a').on('click', (ev) => {
    vscode.postMessage({ command: 'download', thumbnailSize: $(ev.target).data('thumbnail-size') });
});
