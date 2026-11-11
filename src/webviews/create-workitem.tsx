import * as React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { TextField, Dropdown, Button, Option, DataGrid, DataGridRow, DataGridCell, Checkbox } from './components/controls';
import { IActivityDetail, IActivityParam, IWorkItemParam } from '../models/design-automation-api';
import { postMessage } from './common';
import { Actions } from './components/Actions';

export interface ICreateWorkItemProps {
    activity: IActivityDetail;
}

interface IParameter {
    name: string;
    url: string;
    localName?: string;
    optional?: boolean;
    pathInZip?: string;
    headers?: string;
    verb?: string;
}

function unpackParameters(params: { [key: string]: IActivityParam }): IParameter[] {
    const list: IParameter[] = [];
    for (const [name, { localName, verb }] of Object.entries(params)) {
        list.push({ name, url: '', verb, localName });
    }
    return list;
}

function packParameters(params: IParameter[]): ({ [key: string]: IWorkItemParam }) {
    const map: { [key: string]: IWorkItemParam } = {};
    for (const param of params) {
        map[param.name] = {
            url: param.url,
            localName: param.localName,
            optional: param.optional,
            pathInZip: param.pathInZip,
            headers: undefined,
            verb: param.verb
        };
        if (param.headers) {
            map[param.name].headers = {};
            for (const header of param.headers.trim().split(';')) {
                const tokens = header.split(':');
                (map[param.name].headers as any)[tokens[0].trim()] = tokens[1].trim();
            }
        }
    }
    return map;
}

const CreateWorkItem = ({ activity }: ICreateWorkItemProps) => {
    const [parameters, setParameters] = useState<IParameter[]>(activity.parameters ? unpackParameters(activity.parameters) : []);
    const updateParameter = (newIndex: number, newParameter: IParameter) => setParameters(parameters.map((param, i) => i === newIndex ? newParameter : param));
    const ParameterPropertyInput = ({ index, parameter, field, placeholder }: { index: number, parameter: IParameter, field: 'name' | 'url' | 'localName' | 'pathInZip' | 'headers', placeholder?: string }) => (
        <TextField value={parameter[field] || ''} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).value })} placeholder={placeholder} />
    );
    const ParameterPropertyCheckbox = ({ index, parameter, field }: { index: number, parameter: IParameter, field: 'optional' }) => (
        <Checkbox checked={!!parameter[field]} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).checked })} />
    );

    function createWorkItem() {
        postMessage({
            command: 'create',
            parameters: packParameters(parameters)
        });
    }

    return (
        <div>
            <h1>Create Work Item: {activity.id}</h1>

            <h2>Parameters</h2>
            <DataGrid gridTemplateColumns="repeat(7, 1fr) 8em">
                <DataGridRow key={'header'} row-type="header">
                    <DataGridCell cell-type="columnheader" grid-column="1">Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="2">Value</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="3">Verb</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="4">Optional</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="5">Local Name</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="6">Path in Zip</DataGridCell>
                    <DataGridCell cell-type="columnheader" grid-column="7">Headers</DataGridCell>
                </DataGridRow>
                {parameters.map((param, i) => (
                    <DataGridRow key={`param-${i + 1}`}>
                        <DataGridCell grid-column="1">
                            <ParameterPropertyInput index={i} parameter={param} field={"name"} />
                        </DataGridCell>
                        <DataGridCell grid-column="2">
                            <ParameterPropertyInput index={i} parameter={param} field={"url"} />
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
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"optional"} />
                        </DataGridCell>
                        <DataGridCell grid-column="5">
                            <ParameterPropertyInput index={i} parameter={param} field={"localName"} placeholder={"Local Name"} />
                        </DataGridCell>
                        <DataGridCell grid-column="6">
                            <ParameterPropertyInput index={i} parameter={param} field={"pathInZip"} placeholder={"Path in Zip"} />
                        </DataGridCell>
                        <DataGridCell grid-column="7">
                            <ParameterPropertyInput index={i} parameter={param} field={"headers"} placeholder={"HeaderA:ValueA;HeaderB:ValueB"} />
                        </DataGridCell>
                    </DataGridRow>
                ))}
            </DataGrid>

            <Actions>
                <Button onClick={createWorkItem}>Create</Button>
            </Actions>
        </div>
    );
};

export function render(container: HTMLElement, props: ICreateWorkItemProps) {
    ReactDOM.createRoot(container).render(<CreateWorkItem {...props} />);
}