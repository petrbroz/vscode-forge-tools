const vscode = acquireVsCodeApi();

$('#start').click(function () {
    let parameters = {};
    
    $('#parameters > tbody > tr').each(function () {
        const $row = $(this);
        const name = $row.find("input[name='param-name']").val();
        const verb = $row.find("select[name='param-verb']").val();

        if (verb === 'read') {
            parameters[name] = {
                value: $row.find("input[name='param-value']").val(),
            };
        } else {
            parameters[name] = {
                url: $row.find("input[name='param-value']").val(),
                verb: verb,
                optional: $row.find("input[name='param-optional']")[0].checked
            };
            const localName = $row.find("input[name='param-local']").val();
            if (localName) {
                parameters[name].localName = localName;
            }
            const pathInZip = $row.find("input[name='param-pathinzip']").val();
            if (pathInZip) {
                parameters[name].pathInZip = pathInZip;
            }
            const headers = $row.find("input[name='param-headers']").val();
            if (headers) {
                parameters[name].headers = {};
                for (const header of headers.split(';')) {
                    const tokens = header.split(':');
                    parameters[name].headers[tokens[0].trim()] = tokens[1].trim();
                }
            }
        }
    });
    vscode.postMessage({
        command: 'start',
        parameters
    });
});

$('#cancel').click(function () {
    vscode.postMessage({ command: 'cancel' });
});
