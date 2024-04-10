import * as React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField, VSCodeDropdown, VSCodeButton, VSCodeOption, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { IActivityDetail, IActivityParam, ICodeOnEngineStringSetting, ICodeOnEngineUrlSetting } from 'aps-sdk-node';
import { postMessage } from './common';
import { Grid } from './components/Grid';
import { Actions } from './components/Actions';

export interface IUpdateActivityProps {
    activity: IActivityDetail;
    options: {
        engines: string[];
        appBundles: string[];
    };
}

function unpackParameters(params: { [key: string]: IActivityParam }): IActivityParam[] {
    return Object.entries(params).map(([name, param]) => ({ ...param, name }));
}

function packParameters(params: IActivityParam[]): ({ [key: string]: IActivityParam }) {
    const map: { [key: string]: IActivityParam } = {};
    for (const param of params) {
        map[param.name] = param;
    }
    return map;
}

function unpackStringSettings(settings: { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting }): ICodeOnEngineStringSetting[] {
    return Object.entries(settings).map(([name, setting]) => ({ ...setting, name })).filter(s => 'value' in s);
}

function unpackUrlSettings(settings: { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting }): ICodeOnEngineUrlSetting[] {
    return Object.entries(settings).map(([name, setting]) => ({ ...setting, name })).filter(s => 'url' in s);
}

function packSettings(stringSettings: ICodeOnEngineStringSetting[], urlSettings: ICodeOnEngineUrlSetting[]): ({ [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting }) {
    const map: { [key: string]: ICodeOnEngineStringSetting | ICodeOnEngineUrlSetting } = {};
    for (const setting of stringSettings) {
        map[setting.name] = setting;
    }
    for (const setting of urlSettings) {
        map[setting.name] = setting;
    }
    return map;
}

function parseDesignAutomationID(id: string) {
    const d = id.indexOf('.'), p = id.indexOf('+');
    return {
        owner: id.substring(0, d),
        name: id.substring(d + 1, p),
        alias: id.substring(p + 1)
    };
}

const UpdateActivity = ({ activity, options }: IUpdateActivityProps) => {
    const [id, setId] = useState(activity.id);
    const [description, setDescription] = useState(activity.description || '');
    const [engine, setEngine] = useState(activity.engine);
    const [commands, setCommands] = useState<string[]>(activity.commandLine);
    const [parameters, setParameters] = useState<IActivityParam[]>(activity.parameters ? unpackParameters(activity.parameters) : []);
    const [stringSettings, setStringSettings] = useState<ICodeOnEngineStringSetting[]>(activity.settings ? unpackStringSettings(activity.settings) : []);
    const [urlSettings, setUrlSettings] = useState<ICodeOnEngineUrlSetting[]>(activity.settings ? unpackUrlSettings(activity.settings) : []);
    const [appBundles, setAppBundles] = useState<string[]>(activity.appbundles || []);

    function commandLinePreset(): string {
        const engineId = parseDesignAutomationID(engine);
        const firstInputName = parameters.find(param => param.verb === 'get') as IActivityParam;
        const firstBundle = appBundles.length > 0 ? parseDesignAutomationID(appBundles[0]) : undefined;
        debugger;
        switch (engineId.name.toLowerCase()) {
            case 'autocad':
                return `$(engine.path)\\\\accoreconsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.name}].path)"` : ''}`;
            case '3dsmax':
                return `"$(engine.path)/3dsmaxbatch.exe" ${firstInputName ? `-sceneFile "$(args[${firstInputName.name}].path)"` : ''}`;
            case 'revit':
                return `$(engine.path)\\\\revitcoreconsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.name}].path)"` : ''}`;
            case 'inventor':
                return `$(engine.path)\\\\InventorCoreConsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.name}].path)"` : ''}`;
        }
        return '';
    }

    const addCommand = () => setCommands([...commands, commandLinePreset()]);
    const removeCommand = (index: number) => setCommands(commands.filter((_, i) => i !== index));
    const updateCommand = (newIndex: number, newCommand: string) => setCommands(commands.map((command, i) => i === newIndex ? newCommand : command));

    const addParameter = () => setParameters([...parameters, { name: '', verb: 'get' }]);
    const removeParameter = (index: number) => setParameters(parameters.filter((_, i) => i !== index));
    const updateParameter = (newIndex: number, newParameter: IActivityParam) => setParameters(parameters.map((param, i) => i === newIndex ? newParameter : param));
    const ParameterPropertyInput = ({ index, parameter, field }: { index: number, parameter: IActivityParam, field: keyof IActivityParam }) => (
        <VSCodeTextField value={parameter[field] || ''} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).value })}></VSCodeTextField>
    );
    const ParameterPropertyCheckbox = ({ index, parameter, field }: { index: number, parameter: IActivityParam, field: keyof IActivityParam }) => (
        <VSCodeCheckbox checked={!!parameter[field]} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).checked })}></VSCodeCheckbox>
    );

    const addStringSetting = () => setStringSettings([...stringSettings, { name: '', value: '', isEnvironmentVariable: false }]);
    const removeStringSetting = (index: number) => setStringSettings(stringSettings.filter((_, i) => i !== index));
    const updateStringSetting = (newIndex: number, newStringSetting: ICodeOnEngineStringSetting) => setStringSettings(stringSettings.map((setting, i) => i === newIndex ? newStringSetting : setting));

    const addUrlSetting = () => setUrlSettings([...urlSettings, { name: '', url: '', verb: 'get' }]);
    const removeUrlSetting = (index: number) => setUrlSettings(urlSettings.filter((_, i) => i !== index));
    const updateUrlSetting = (newIndex: number, newUrlSetting: ICodeOnEngineUrlSetting) => setUrlSettings(urlSettings.map((setting, i) => i === newIndex ? newUrlSetting : setting));

    const addAppBundle = () => setAppBundles([...appBundles, '']);
    const removeAppBundle = (index: number) => setAppBundles(appBundles.filter((_, i) => i !== index));
    const updateAppBundle = (newIndex: number, newappBundle: string) => setAppBundles(appBundles.map((appBundle, i) => i === newIndex ? newappBundle : appBundle));

    function updateActivity() {
        postMessage({
            command: 'update',
            activity: {
                id, description, engine,
                commands,
                parameters: packParameters(parameters),
                settings: packSettings(stringSettings, urlSettings),
                appBundles
            }
        });
    }

    return (
        <div>
            <h1>Update Activity: {activity.id}</h1>

            <Grid>
                <VSCodeTextField value={id} onChange={ev => setId((ev.target as any).value)} placeholder="Activity name">ID</VSCodeTextField>
                <VSCodeTextField value={description} onChange={ev => setDescription((ev.target as any).value)} placeholder="Activity description">Description</VSCodeTextField>
                <VSCodeDropdown value={engine} onChange={ev => setEngine((ev.target as any).value)}>
                    {options.engines.map(engine => <VSCodeOption value={engine}>{engine}</VSCodeOption>)}
                </VSCodeDropdown>
            </Grid>

            <h2>Commands</h2>
            <Grid columns={'1fr 8em'}>
                {commands.map((command, i) => (
                    <>
                        <VSCodeTextField key={`txt-${i}`} value={command} onChange={ev => updateCommand(i, (ev.target as any).value)}></VSCodeTextField>
                        <VSCodeButton appearance="secondary" key={`btn-${i}`} onClick={() => removeCommand(i)}>Remove</VSCodeButton>
                    </>
                ))}
            </Grid>
            <VSCodeButton appearance="secondary" onClick={addCommand} style={{ marginTop: '1em' }}>
                Add Command {/* TODO: figure out a way to add icons (codicons?) */}
            </VSCodeButton>

            <h2>Parameters</h2>
            <VSCodeDataGrid gridTemplateColumns="repeat(7, 1fr) 8em">
                <VSCodeDataGridRow key={0} row-type="header">
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="1">Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Description</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Verb</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="4">Local Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="5">Required</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="6">Zip</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="7">On Demand</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="8"></VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {parameters.map((param, i) => (
                    <VSCodeDataGridRow key={i + 1}>
                        <VSCodeDataGridCell grid-column="1">
                            <ParameterPropertyInput index={i} parameter={param} field={"name"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="2">
                            <ParameterPropertyInput index={i} parameter={param} field={"description"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="3">
                            <VSCodeDropdown value={param.verb || 'get'} onChange={ev => updateParameter(i, { ...param, verb: (ev.target as any).value })}>
                                <VSCodeOption value={"get"}>GET</VSCodeOption>
                                <VSCodeOption value={"put"}>PUT</VSCodeOption>
                                <VSCodeOption value={"post"}>POST</VSCodeOption>
                                <VSCodeOption value={"patch"}>PATCH</VSCodeOption>
                                <VSCodeOption value={"read"}>READ</VSCodeOption>
                            </VSCodeDropdown>
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="4">
                            <ParameterPropertyInput index={i} parameter={param} field={"localName"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="5">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"required"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="6">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"zip"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="7">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"ondemand"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="8">
                            <VSCodeButton appearance="secondary" onClick={() => removeParameter(i)}>Remove</VSCodeButton>
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                ))}
            </VSCodeDataGrid>
            <VSCodeButton appearance="secondary" onClick={addParameter} style={{ marginTop: '1em' }}>
                Add Parameter {/* TODO: figure out a way to add icons (codicons?) */}
            </VSCodeButton>

            <h2>Settings</h2>

            <h3>String Settings</h3>
            <VSCodeDataGrid gridTemplateColumns="repeat(3, 1fr) 8em">
                <VSCodeDataGridRow key={0} row-type="header">
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="1">Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Value</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Is Env.</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="4"></VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {stringSettings.map((setting, i) => (
                    <VSCodeDataGridRow key={i + 1}>
                        <VSCodeDataGridCell grid-column="1">
                            <VSCodeTextField value={setting.name} onChange={ev => updateStringSetting(i, { ...setting, name: (ev.target as any).value })} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="2">
                            <VSCodeTextField value={setting.value} onChange={ev => updateStringSetting(i, { ...setting, value: (ev.target as any).value })} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="3">
                            <VSCodeCheckbox checked={setting.isEnvironmentVariable} onChange={ev => updateStringSetting(i, { ...setting, isEnvironmentVariable: (ev.target as any).checked })} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="4">
                            <VSCodeButton appearance="secondary" onClick={() => removeStringSetting(i)}>Remove</VSCodeButton>
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                ))}
            </VSCodeDataGrid>
            <VSCodeButton appearance="secondary" onClick={addStringSetting} style={{ marginTop: '1em' }}>
                Add String Setting {/* TODO: figure out a way to add icons (codicons?) */}
            </VSCodeButton>

            <h3>URL Settings</h3>
            <VSCodeDataGrid gridTemplateColumns="repeat(3, 1fr) 8em">
                <VSCodeDataGridRow key={0} row-type="header">
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="1">Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="2">URL</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Verb</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="4"></VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {urlSettings.map((setting, i) => (
                    <VSCodeDataGridRow key={i + 1}>
                        <VSCodeDataGridCell grid-column="1">
                            <VSCodeTextField value={setting.name} onChange={ev => updateUrlSetting(i, { ...setting, name: (ev.target as any).value })} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="2">
                            <VSCodeTextField value={setting.url} onChange={ev => updateUrlSetting(i, { ...setting, url: (ev.target as any).value })} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="3">
                            <VSCodeDropdown value={setting.verb || 'get'} onChange={ev => updateUrlSetting(i, { ...setting, verb: (ev.target as any).value })}>
                                <VSCodeOption value={"get"}>GET</VSCodeOption>
                                <VSCodeOption value={"put"}>PUT</VSCodeOption>
                                <VSCodeOption value={"post"}>POST</VSCodeOption>
                                <VSCodeOption value={"patch"}>PATCH</VSCodeOption>
                            </VSCodeDropdown>
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="4">
                            <VSCodeButton appearance="secondary" onClick={() => removeUrlSetting(i)}>Remove</VSCodeButton>
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                ))}
            </VSCodeDataGrid>
            <VSCodeButton appearance="secondary" onClick={addUrlSetting} style={{ marginTop: '1em' }}>
                Add URL Setting {/* TODO: figure out a way to add icons (codicons?) */}
            </VSCodeButton>

            <h2>App Bundles</h2>
            <Grid columns={'1fr 8em'}>
                {appBundles.map((appBundle, i) => (
                    <>
                        <VSCodeDropdown key={`dropdown-${i}`} value={appBundle || options.appBundles[0]} onChange={ev => updateAppBundle(i, (ev.target as any).value)}>
                            {options.appBundles.map(bundle => <VSCodeOption value={bundle}>{bundle}</VSCodeOption>)}
                        </VSCodeDropdown>
                        <VSCodeButton appearance="secondary" key={`btn-${i}`} onClick={() => removeAppBundle(i)}>Remove</VSCodeButton>
                    </>
                ))}
            </Grid>
            <VSCodeButton appearance="secondary" onClick={addAppBundle} style={{ marginTop: '1em' }}>
                Add App Bundle {/* TODO: figure out a way to add icons (codicons?) */}
            </VSCodeButton>

            <Actions>
                <VSCodeButton onClick={updateActivity}>Update</VSCodeButton>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: IUpdateActivityProps) {
    ReactDOM.createRoot(container).render(<UpdateActivity {...props} />);
}