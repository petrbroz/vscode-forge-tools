import * as React from 'react';
import { VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';

interface IEnumDropdownProps<T extends string | number> {
    label: string;
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
    formatOption?: (value: T) => string;
    style?: React.CSSProperties;
}

/**
 * A labeled dropdown for picking one of a small set of string/number literal values.
 * `VSCodeDropdown`'s only slot is its list of options, so the label has to be rendered separately
 * (unlike `VSCodeTextField`/`VSCodeCheckbox`, whose children *are* their label).
 */
export function EnumDropdown<T extends string | number>({ label, value, options, onChange, formatOption, style }: IEnumDropdownProps<T>) {
    function handleChange(ev: Event | React.FormEvent<HTMLElement>) {
        const raw = (ev.target as any).value;
        const matched = options.find(option => String(option) === raw);
        if (matched !== undefined) {
            onChange(matched);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
            <label>{label}</label>
            <VSCodeDropdown style={{ width: '100%' }} value={String(value)} onChange={handleChange}>
                {options.map(option => (
                    <VSCodeOption value={String(option)} key={option}>
                        {formatOption ? formatOption(option) : String(option)}
                    </VSCodeOption>
                ))}
            </VSCodeDropdown>
        </div>
    );
}
