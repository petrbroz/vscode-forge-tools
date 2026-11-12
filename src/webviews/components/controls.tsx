import * as React from 'react';
import {
    VscodeButton,
    VscodeCheckbox,
    VscodeDivider,
    VscodeOption,
    VscodeSingleSelect,
    VscodeTextarea,
    VscodeTextfield
} from '@vscode-elements/react-elements';

/**
 * Thin wrappers around `@vscode-elements/react-elements` that keep the "label as children" and
 * `onChange`-fires-on-every-edit conventions the webviews were written against.
 */

type Handler = (ev: any) => void;

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };

interface ITextFieldProps {
    value?: string;
    readOnly?: boolean;
    disabled?: boolean;
    placeholder?: string;
    onChange?: Handler;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export const TextField = ({ children, readOnly, onChange, style, ...rest }: ITextFieldProps) => {
    const input = <VscodeTextfield {...rest} readonly={readOnly} onInput={onChange} style={children ? { width: '100%' } : style} />;
    return children ? <div style={{ ...fieldStyle, ...style }}><label>{children}</label>{input}</div> : input;
};

interface ITextAreaProps {
    value?: string;
    readOnly?: boolean;
    rows?: number;
    resize?: 'both' | 'horizontal' | 'vertical' | 'none';
    onChange?: Handler;
    style?: React.CSSProperties;
}

export const TextArea = ({ readOnly, onChange, ...rest }: ITextAreaProps) => (
    <VscodeTextarea {...rest} readonly={readOnly} onInput={onChange} />
);

interface ICheckboxProps {
    checked?: boolean;
    readOnly?: boolean;
    onChange?: Handler;
    children?: React.ReactNode;
}

export const Checkbox = ({ children, readOnly, onChange, checked }: ICheckboxProps) => (
    <VscodeCheckbox checked={checked} disabled={readOnly} onChange={onChange}>{children}</VscodeCheckbox>
);

interface IButtonProps {
    appearance?: 'primary' | 'secondary';
    onClick?: Handler;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export const Button = ({ appearance, children, ...rest }: IButtonProps) => (
    <VscodeButton secondary={appearance === 'secondary'} {...rest}>{children}</VscodeButton>
);

interface IDropdownProps {
    value?: string;
    onChange?: Handler;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export const Dropdown = ({ children, ...rest }: IDropdownProps) => (
    <VscodeSingleSelect {...rest}>{children}</VscodeSingleSelect>
);

export const Option = VscodeOption;
export const Divider = VscodeDivider;

// Simple CSS-grid based data grid (rows are `display: contents` so cells align to the grid's columns).

interface IDataGridProps {
    gridTemplateColumns?: string;
    children?: React.ReactNode;
}

export const DataGrid = ({ gridTemplateColumns, children }: IDataGridProps) => (
    <div style={{ display: 'grid', gridTemplateColumns: gridTemplateColumns ?? 'repeat(auto-fit, minmax(0, 1fr))', gridAutoColumns: '1fr', alignItems: 'center', gap: '4px 8px' }}>
        {children}
    </div>
);

interface IDataGridRowProps {
    'row-type'?: 'header' | 'default';
    children?: React.ReactNode;
}

export const DataGridRow = ({ children }: IDataGridRowProps) => <div style={{ display: 'contents' }}>{children}</div>;

interface IDataGridCellProps {
    'cell-type'?: 'columnheader' | 'default';
    'grid-column'?: string;
    children?: React.ReactNode;
}

export const DataGridCell = (props: IDataGridCellProps) => (
    <div style={{ fontWeight: props['cell-type'] === 'columnheader' ? 'bold' : undefined, gridColumn: props['grid-column'], minWidth: 0 }}>
        {props.children}
    </div>
);
