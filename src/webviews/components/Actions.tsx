import * as React from 'react';
import { VSCodeDivider } from '@vscode/webview-ui-toolkit/react';

interface IActionsProps {
    children: React.ReactNode | React.ReactNode[];
}

export const Actions = ({ children }: IActionsProps) => (
    <div style={{ paddingTop: '2em' }}>
        <VSCodeDivider></VSCodeDivider>
        {children}
    </div>
);