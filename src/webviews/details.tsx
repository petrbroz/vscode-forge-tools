import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { DataGrid, DataGridCell, DataGridRow, TextArea, TextField } from './components/controls';
import { Grid } from './components/Grid';

interface IDetailsField {
    label: string;
    value: string;
    multiline?: boolean;
}

interface IDetailsTable {
    title: string;
    columns: string[];
    rows: string[][];
    columnWidths?: string;
    emptyMessage?: string;
}

interface IDetailsProps {
    title: string;
    fields: IDetailsField[];
    tables?: IDetailsTable[];
}

const Details = ({ title, fields, tables }: IDetailsProps) => (
    <div>
        <h1>{title}</h1>
        <Grid columns="repeat(auto-fit, minmax(220px, 1fr))">
            {fields.map(({ label, value, multiline }) => (
                multiline
                    ? <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><label>{label}</label><TextArea readOnly resize="vertical" rows={4} value={value} /></div>
                    : <TextField key={label} readOnly value={value}>{label}</TextField>
            ))}
        </Grid>
        {tables?.map(({ title: tableTitle, columns, rows, columnWidths, emptyMessage }) => (
            <section key={tableTitle}>
                <h2>{tableTitle}</h2>
                <DataGrid gridTemplateColumns={columnWidths ?? `repeat(${columns.length}, minmax(0, 1fr))`}>
                    <DataGridRow row-type="header">
                        {columns.map((column, i) => <DataGridCell key={column} cell-type="columnheader" grid-column={(i + 1).toString()}>{column}</DataGridCell>)}
                    </DataGridRow>
                    {rows.map((row, i) => (
                        <DataGridRow key={i}>
                            {row.map((value, j) => <DataGridCell key={j} grid-column={(j + 1).toString()}>{value}</DataGridCell>)}
                        </DataGridRow>
                    ))}
                </DataGrid>
                {rows.length === 0 && emptyMessage && <p>{emptyMessage}</p>}
            </section>
        ))}
    </div>
);

export function render(container: HTMLElement, props: IDetailsProps) {
    ReactDOM.createRoot(container).render(<Details {...props} />);
}
