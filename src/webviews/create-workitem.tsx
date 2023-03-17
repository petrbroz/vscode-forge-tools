import * as React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeTextField, VSCodeDropdown, VSCodeButton, VSCodeOption, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeCheckbox, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { IActivityDetail, IActivityParam, IWorkItemParam } from 'forge-server-utils';
import { postMessage } from './common';

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
    const ParameterPropertyInput = ({ index, parameter, field, placeholder }: { index: number, parameter: IParameter, field: keyof IParameter, placeholder?: string }) => (
        <VSCodeTextField value={parameter[field] || ''} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).value })} placeholder={placeholder} />
    );
    const ParameterPropertyCheckbox = ({ index, parameter, field }: { index: number, parameter: IParameter, field: keyof IParameter }) => (
        <VSCodeCheckbox checked={!!parameter[field]} onChange={ev => updateParameter(index, { ...parameter, [field]: (ev.target as any).checked })} />
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
            <VSCodeDataGrid gridTemplateColumns="repeat(7, 1fr) 8em">
                <VSCodeDataGridRow key={'header'} row-type="header">
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="1">Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="2">Value</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="3">Verb</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="4">Optional</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="5">Local Name</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="6">Path in Zip</VSCodeDataGridCell>
                    <VSCodeDataGridCell cell-type="columnheader" grid-column="7">Headers</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {parameters.map((param, i) => (
                    <VSCodeDataGridRow key={`param-${i + 1}`}>
                        <VSCodeDataGridCell grid-column="1">
                            <ParameterPropertyInput index={i} parameter={param} field={"name"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="2">
                            <ParameterPropertyInput index={i} parameter={param} field={"url"} />
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
                            <ParameterPropertyCheckbox index={i} parameter={param} field={"optional"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="5">
                            <ParameterPropertyInput index={i} parameter={param} field={"localName"} placeholder={"Local Name"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="6">
                            <ParameterPropertyInput index={i} parameter={param} field={"pathInZip"} placeholder={"Path in Zip"} />
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell grid-column="7">
                            <ParameterPropertyInput index={i} parameter={param} field={"headers"} placeholder={"HeaderA:ValueA;HeaderB:ValueB"} />
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                ))}
            </VSCodeDataGrid>

            <VSCodeDivider style={{ marginTop: '1em', marginBottom: '1em' }} />
            <VSCodeButton onClick={createWorkItem}>Create</VSCodeButton>
        </div>
    );
};

export function render(container: HTMLElement, props: ICreateWorkItemProps) {
    ReactDOM.createRoot(container).render(<CreateWorkItem {...props} />);
}