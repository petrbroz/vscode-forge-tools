const vscode = acquireVsCodeApi();

$('#start').click(function () {
    vscode.postMessage({
        command: 'start',
        parameters: {
            compressedRootDesign: $('#root-filename').val(),
            switchLoader: $('#switch-loader').is(':checked'),
            generateMasterViews: $('#master-views').is(':checked')
        }
    });
});

$('#cancel').click(function () {
    vscode.postMessage({ command: 'cancel' });
});
