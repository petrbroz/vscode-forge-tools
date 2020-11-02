const vscode = acquireVsCodeApi();

function collectActivity() {
    let activity = {
        id: $('#activity-id').val(),
        description: $('#activity-description').val(),
        engine: $('#activity-engine').val(),
        commandLine: $("#command-lines input[name='command-line']").map(function () { return $(this).val(); }).get(),
        appBundles: $("#appbundles select[name='appbundle']").map(function () { return $(this).val(); }).get(),
        parameters: {},
        settings: {}
    };
    $('#parameters > tbody > tr').each(function () {
        const $row = $(this);
        const name = $row.find("input[name='param-name']").val();
        activity.parameters[name] = {
            verb: $row.find("select[name='param-verb']").val(),
            description: $row.find("input[name='param-desc']").val(),
            localName: $row.find("input[name='param-local']").val(),
            required: $row.find("input[name='param-required']")[0].checked,
            zip: $row.find("input[name='param-zip']")[0].checked,
            ondemand: $row.find("input[name='param-ondemand']")[0].checked
        };
    });
    
    $('#settings-string > tbody > tr').each(function () {
        const $row = $(this);
        const name = $row.find("input[name='setting-name']").val();
        activity.settings[name] = {
            value: $row.find("input[name='setting-value']").val(),
            isEnvironmentVariable: $row.find("input[name='setting-env']")[0].checked
        };
    });

    $('#settings-url > tbody > tr').each(function () {
        const $row = $(this);
        const name = $row.find("input[name='setting-name']").val();
        activity.settings[name] = {
            url: $row.find("input[name='setting-url']").val(),
            verb: $row.find("select[name='setting-verb']").val()
        };
    });

    return activity;
}

function parseDesignAutomationID(id) {
    const d = id.indexOf('.'), p = id.indexOf('+');
    return {
        owner: id.substr(0, d),
        name: id.substr(d + 1, p - d - 1),
        alias: id.substr(p)
    };
}

function commandLinePreset() {
    const activity = collectActivity();
    const engineId = parseDesignAutomationID(activity.engine);
    const firstInputName = Object.keys(activity.parameters).find(name => activity.parameters[name].verb === 'get');
    const firstBundle = activity.appBundles.length > 0 ? parseDesignAutomationID(activity.appBundles[0]) : undefined;
    // TODO: what's the command structure for additional inputs and app bundles?
    switch (engineId.name.toLowerCase()) {
        case 'autocad':
            return `$(engine.path)\\\\accoreconsole.exe ${firstInputName ? `/i $(args[${firstInputName}].path)` : ''} ${firstBundle ? `/al $(appbundles[${firstBundle.name}].path)` : ''}`;
        case '3dsmax':
            return `$(engine.path)/3dsmaxbatch.exe ${firstInputName ? `-sceneFile \\"$(args[${firstInputName}].path)\"` : ''}`;
        case 'revit':
            return `$(engine.path)\\\\revitcoreconsole.exe ${firstInputName ? `/i $(args[${firstInputName}].path)` : ''} ${firstBundle ? `/al $(appbundles[${firstBundle.name}].path)` : ''}`;
        case 'inventor':
            return `$(engine.path)\\\\InventorCoreConsole.exe ${firstInputName ? `/i $(args[${firstInputName}].path)` : ''} ${firstBundle ? `/al $(appbundles[${firstBundle.name}].path)` : ''}`;
    }
    return '';
}

$("button[name='add-command-line']").click(function () {
    $('#command-lines > tbody').append(`
        <tr>
            <td style="width: 95%">
                <input type="text" name="command-line" class="form-control" value="" placeholder="Enter New Command">
            </td>
            <td style="width: 5%">
                <button type="button" name="preset-command-line" class="form-control btn btn-outline-success fas fa-magic" data-action="preset" title="Pre-generate command based on existing settings"></button>
            </td>
            <td style="width: 5%">
                <button type="button" name="remove-command-line" class="form-control btn btn-outline-danger fas fa-trash-alt" data-action="remove"></button>
            </td>
        </tr>
    `);
});

$('#command-lines > tbody').click(function (ev) {
    const $target = $(ev.target);
    switch ($target.data('action')) {
        case 'preset':
            $target.closest('tr').find("input[name='command-line']").val(commandLinePreset());
            break;
        case 'remove':
            $target.closest('tr').remove();
            break;
    }
});

$("button[name='add-parameter']").click(function () {
    $('#parameters > tbody').append(`
        <tr>
            <td>
                <input type="text" name="param-name" class="form-control" value="" placeholder="Parameter Name">
            </td>
            <td>
                <select name="param-verb" class="form-control">
                    <option value="get">Get</option>
                    <option value="put">Put</option>
                    <option value="post">Post</option>
                    <option value="patch">Patch</option>
                    <option value="read">Read</option>
                </select>
            </td>
            <td>
                <input type="text" name="param-desc" class="form-control" value="" placeholder="Parameter Description">
            </td>
            <td>
                <input type="text" name="param-local" class="form-control" value="" placeholder="Parameter Local Name">
            </td>
            <td>
                <input type="checkbox" name="param-required" class="form-control">
            </td>
            <td>
                <input type="checkbox" name="param-zip" class="form-control">
            </td>
            <td>
                <input type="checkbox" name="param-ondemand" class="form-control">
            </td>
            <td>
                <button type="button" name="remove-parameter" class="form-control btn btn-outline-danger fas fa-trash-alt" data-action="remove"></button>
            </td>
        </tr>
    `);
});

$("button[name='add-setting-string']").click(function () {
    $('#settings-string > tbody').append(`
        <tr>
            <td>
                <input type="text" name="setting-name" class="form-control" value="" placeholder="Setting Name">
            </td>
            
            <td>
                <input type="text" name="setting-value" class="form-control" value="" placeholder="Setting Value">
            </td>
            
            <td>
                <input type="checkbox" name="setting-env" class="form-control">
            </td>
            
            <td>
                <button type="button" name="remove-setting-string" class="form-control btn btn-outline-danger fas fa-trash-alt" data-action="remove"></button>
            </td>
        </tr>
    `);
});

$("button[name='add-setting-url']").click(function () {
    $('#settings-url > tbody').append(`
        <tr>
            <td>
                <input type="text" name="setting-name" class="form-control" value="" placeholder="Setting Name">
            </td>
            
            <td>
                <input type="text" name="setting-url" class="form-control" value="" placeholder="Setting Url">
            </td>
            
            <td>
                <select name="setting-verb" class="form-control">
                    <option value="get">Get</option>
                    <option value="put">Put</option>
                    <option value="post">Post</option>
                    <option value="patch">Patch</option>
                </select>
            </td>
            
            <td>
                <button type="button" name="remove-setting-url" class="form-control btn btn-outline-danger fas fa-trash-alt" data-action="remove"></button>
            </td>
        </tr>
    `);
});

$('#parameters > tbody').click(function (ev) {
    const $target = $(ev.target);
    if ($target.data('action') === 'remove') {
        $target.closest('tr').remove();
    }
});

$('#settings-string > tbody').click(function (ev) {
    const $target = $(ev.target);
    if ($target.data('action') === 'remove') {
        $target.closest('tr').remove();
    }
});

$('#settings-url > tbody').click(function (ev) {
    const $target = $(ev.target);
    if ($target.data('action') === 'remove') {
        $target.closest('tr').remove();
    }
});

$("button[name='add-appbundle']").click(function () {
    const selectTemplate = document.getElementById('appbundles-template').innerHTML;
    $('#appbundles > tbody').append(`
        <tr>
            <td style="width: 95%">
                <select name="appbundle" class="form-control">
                    ${selectTemplate}
                </select>
            </td>
            <td style="width: 5%">
                <button type="button" name="remove-appbundle" class="form-control btn btn-outline-danger fas fa-trash-alt" data-action="remove"></button>
            </td>
        </tr>
    `);
});

$('#appbundles > tbody').click(function (ev) {
    const $target = $(ev.target);
    if ($target.data('action') === 'remove') {
        $target.closest('tr').remove();
    }
});

$('#create').click(function () {
    const activity = collectActivity();
    vscode.postMessage({
        command: 'create',
        activity
    });
});

$('#cancel').click(function () {
    vscode.postMessage({ command: 'cancel' });
});
