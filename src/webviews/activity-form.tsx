import * as React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { TextField, Dropdown, Button, Option, DataGrid, DataGridRow, DataGridCell, Checkbox } from './components/controls';
import { DesignAutomationID, IActivityDetail, IActivityParam, ICodeOnEngineStringSetting, ICodeOnEngineUrlSetting } from '../models/design-automation-api';
import { postMessage } from './common';
import { Grid } from './components/Grid';
import { Actions } from './components/Actions';

export interface IActivityFormProps {
    initial?: IActivityDetail;
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

const ActivityForm = ({ initial, options }: IActivityFormProps) => {
    const [id, setId] = useState(initial?.id ?? '');
    const [description, setDescription] = useState(initial?.description || '');
    const [engine, setEngine] = useState(initial?.engine ?? options.engines[0]);
    const [commands, setCommands] = useState<string[]>(initial?.commandLine ?? []);
    const [parameters, setParameters] = useState<IActivityParam[]>(initial?.parameters ? unpackParameters(initial.parameters) : []);
    const [stringSettings, setStringSettings] = useState<ICodeOnEngineStringSetting[]>(initial?.settings ? unpackStringSettings(initial.settings) : []);
    const [urlSettings, setUrlSettings] = useState<ICodeOnEngineUrlSetting[]>(initial?.settings ? unpackUrlSettings(initial.settings) : []);
    const [appBundles, setAppBundles] = useState<string[]>(initial?.appbundles ?? [options.appBundles[0]]);

    function commandLinePreset(): string {
        const engineName = DesignAutomationID.parse(engine)?.id ?? '';
        const firstInputName = parameters.find(param => param.verb === 'get') as IActivityParam;
        const firstBundle = appBundles.length > 0 ? DesignAutomationID.parse(appBundles[0]) : undefined;
        switch (engineName.toLowerCase()) {
            case 'autocad':
                return `$(engine.path)\\\\accoreconsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.id}].path)"` : ''}`;
            case '3dsmax':
                return `"$(engine.path)/3dsmaxbatch.exe" ${firstInputName ? `-sceneFile "$(args[${firstInputName.name}].path)"` : ''}`;
            case 'revit':
                return `$(engine.path)\\\\revitcoreconsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.id}].path)"` : ''}`;
            case 'inventor':
                return `$(engine.path)\\\\InventorCoreConsole.exe ${firstInputName ? `/i "$(args[${firstInputName.name}].path)"` : ''} ${firstBundle ? `/al "$(appbundles[${firstBundle.id}].path)"` : ''}`;
        }
        return '';
    }

    const addCommand = () => setCommands([...commands, commandLinePreset()]);
    const removeCommand = (index: number) => setCommands(commands.filter((_, i) => i !== index));
    const updateCommand = (newIndex: number, newCommand: string) => setCommands(commands.map((command, i) => i === newIndex ? newCommand : command));

    const addParameter = () => setParameters([...parameters, { name: '', verb: 'get' }]);
    const removeParameter = (index: number) => setParameters(parameters.filter((_, i) => i !== index));
    const updateParameter = (newIndex: number, newParameter: IActivityParam) => setParameters(parameters.map((param, i) => i === newIndex ? newParameter : param));
    const ParameterPropertyInput = ({ index, parameter, field }: { index: number, parameter: IActivityParam, field: 'name' | 'description' | 'localName' }) => (
        <TextField value={parameter[field] || ''} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).value })}></TextField>
    );
    const ParameterPropertyCheckbox = ({ index, parameter, field }: { index: number, parameter: IActivityParam, field: 'required' | 'zip' | 'ondemand' }) => (
        <Checkbox checked={!!parameter[field]} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).checked })}></Checkbox>
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

    function submit() {
        postMessage({
            command: initial ? 'update' : 'create',
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
            <h1>{initial ? `Update Activity: ${initial.id}` : 'Create Activity'}</h1>

            <Grid>
                <TextField value={id} onChange={ev => setId((ev.target as any).value)} placeholder="Activity name">ID</TextField>
                <TextField value={description} onChange={ev => setDescription((ev.target as any).value)} placeholder="Activity description">Description</TextField>
                <Dropdown value={engine} onChange={ev => setEngine((ev.target as any).value)}>
                    {options.engines.map(engine => <Option value={engine}>{engine}</Option>)}
                </Dropdown>
            </Grid>

            <h2>Commands</h2>
            <Grid columns={'1fr 8em'}>
                {commands.map((command, i) => (
                    <>
                        <TextField key={`txt-${i}`} value={command} onChange={ev => updateCommand(i, (ev.target as any).value)}></TextField>
                        <Button appearance="secondary" key={`btn-${i}`} onClick={() => removeCommand(i)}>Remove</Button>
                    </>
                ))}
            </Grid>
            <Button appearance="secondary" onClick={addCommand} style={{ marginTop: '1em' }}>
                Add Command {/* TODO: figure out a way to add icons (codicons?) */}
            </Button>

            <h2>Parameters</h2>
            <DataGrid gridTemplateColumns="repeat(7, 1fr) 8em">
                <DataGridRow key={0} row-type="header">
                    <DataGridCell cell-type="columnheader" grid-column="1">Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="2">Description</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="3">Verb</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="4">Local Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="5">Required</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="6">Zip</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="7">On Demand</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="8"></DataGridCell>
                </DataGridRow>
                {parameters.map((param, i) => (
                    <DataGridRow key={i + 1}>
                        <DataGridCell grid-column="1">
                            <ParameterPropertyInput index={i} parameter={param} field={"name"} />
                        </DataGridCell>
                        <DataGridCell grid-column="2">
                            <ParameterPropertyInput index={i} parameter={param} field={"description"} />
                        </DataGridCell>
                        <DataGridCell grid-column="3">
                            <Dropdown value={param.verb || 'get'} onChange={ev => updateParameter(i, { ...param, verb: (ev.target as any).value })}>
                                <Option value={"get"}>GET</Option>
                                <Option value={"put"}>PUT</Option>
                                <Option value={"post"}>POST</Option>
                                <Option value={"patch"}>PATCH</Option>
                                <Option value={"read"}>READ</Option>
                            </Dropdown>
                        </DataGridCell>
                        <DataGridCell grid-column="4">
                            <ParameterPropertyInput index={i} parameter={param} field={"localName"} />
                        </DataGridCell>
                        <DataGridCell grid-column="5">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"required"} />
                        </DataGridCell>
                        <DataGridCell grid-column="6">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"zip"} />
                        </DataGridCell>
                        <DataGridCell grid-column="7">
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"ondemand"} />
                        </DataGridCell>
                        <DataGridCell grid-column="8">
                            <Button appearance="secondary" onClick={() => removeParameter(i)}>Remove</Button>
                        </DataGridCell>
                    </DataGridRow>
                ))}
            </DataGrid>
            <Button appearance="secondary" onClick={addParameter} style={{ marginTop: '1em' }}>
                Add Parameter {/* TODO: figure out a way to add icons (codicons?) */}
            </Button>

            <h2>Settings</h2>

            <h3>String Settings</h3>
            <DataGrid gridTemplateColumns="repeat(3, 1fr) 8em">
                <DataGridRow key={0} row-type="header">
                    <DataGridCell cell-type="columnheader" grid-column="1">Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="2">Value</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="3">Is Env.</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="4"></DataGridCell>
                </DataGridRow>
                {stringSettings.map((setting, i) => (
                    <DataGridRow key={i + 1}>
                        <DataGridCell grid-column="1">
                            <TextField value={setting.name} onChange={ev => updateStringSetting(i, { ...setting, name: (ev.target as any).value })} />
                        </DataGridCell>
                        <DataGridCell grid-column="2">
                            <TextField value={setting.value} onChange={ev => updateStringSetting(i, { ...setting, value: (ev.target as any).value })} />
                        </DataGridCell>
                        <DataGridCell grid-column="3">
                            <Checkbox checked={setting.isEnvironmentVariable} onChange={ev => updateStringSetting(i, { ...setting, isEnvironmentVariable: (ev.target as any).checked })} />
                        </DataGridCell>
                        <DataGridCell grid-column="4">
                            <Button appearance="secondary" onClick={() => removeStringSetting(i)}>Remove</Button>
                        </DataGridCell>
                    </DataGridRow>
                ))}
            </DataGrid>
            <Button appearance="secondary" onClick={addStringSetting} style={{ marginTop: '1em' }}>
                Add String Setting {/* TODO: figure out a way to add icons (codicons?) */}
            </Button>

            <h3>URL Settings</h3>
            <DataGrid gridTemplateColumns="repeat(3, 1fr) 8em">
                <DataGridRow key={0} row-type="header">
                    <DataGridCell cell-type="columnheader" grid-column="1">Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="2">URL</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="3">Verb</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="4"></DataGridCell>
                </DataGridRow>
                {urlSettings.map((setting, i) => (
                    <DataGridRow key={i + 1}>
                        <DataGridCell grid-column="1">
                            <TextField value={setting.name} onChange={ev => updateUrlSetting(i, { ...setting, name: (ev.target as any).value })} />
                        </DataGridCell>
                        <DataGridCell grid-column="2">
                            <TextField value={setting.url} onChange={ev => updateUrlSetting(i, { ...setting, url: (ev.target as any).value })} />
                        </DataGridCell>
                        <DataGridCell grid-column="3">
                            <Dropdown value={setting.verb || 'get'} onChange={ev => updateUrlSetting(i, { ...setting, verb: (ev.target as any).value })}>
                                <Option value={"get"}>GET</Option>
                                <Option value={"put"}>PUT</Option>
                                <Option value={"post"}>POST</Option>
                                <Option value={"patch"}>PATCH</Option>
                            </Dropdown>
                        </DataGridCell>
                        <DataGridCell grid-column="4">
                            <Button appearance="secondary" onClick={() => removeUrlSetting(i)}>Remove</Button>
                        </DataGridCell>
                    </DataGridRow>
                ))}
            </DataGrid>
            <Button appearance="secondary" onClick={addUrlSetting} style={{ marginTop: '1em' }}>
                Add URL Setting {/* TODO: figure out a way to add icons (codicons?) */}
            </Button>

            <h2>App Bundles</h2>
            <Grid columns={'1fr 8em'}>
                {appBundles.map((appBundle, i) => (
                    <>
                        <Dropdown key={`dropdown-${i}`} value={appBundle || options.appBundles[0]} onChange={ev => updateAppBundle(i, (ev.target as any).value)}>
                            {options.appBundles.map(bundle => <Option value={bundle}>{bundle}</Option>)}
                        </Dropdown>
                        <Button appearance="secondary" key={`btn-${i}`} onClick={() => removeAppBundle(i)}>Remove</Button>
                    </>
                ))}
            </Grid>
            <Button appearance="secondary" onClick={addAppBundle} style={{ marginTop: '1em' }}>
                Add App Bundle {/* TODO: figure out a way to add icons (codicons?) */}
            </Button>

            <Actions>
                <Button onClick={submit}>{initial ? 'Update' : 'Create'}</Button>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: IActivityFormProps) {
    ReactDOM.createRoot(container).render(<ActivityForm {...props} />);
}