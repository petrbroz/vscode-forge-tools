const vscode = acquireVsCodeApi();

$('#create').click(function () {
    vscode.postMessage({
        command: COMMAND,
        webhook: {
            callbackUrl: $('#hook-callback').val(),
            status: $('#hook-status').val(),
            scope: {
                [$('#hook-scope-key').val()]: $('#hook-scope').val()
            },
            filter: $('#hook-filter').val(),
            hookAttribute: $('#hook-attribute').val(),
        }
    });
});

$('#cancel').click(function () {
    vscode.postMessage({ command: 'cancel' });
});
