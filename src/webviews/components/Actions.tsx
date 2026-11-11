import * as React from 'react';
import { Divider } from './controls';

interface IActionsProps {
    children: React.ReactNode | React.ReactNode[];
}

export const Actions = ({ children }: IActionsProps) => (
    <div style={{ paddingTop: '2em' }}>
        <Divider></Divider>
        {children}
    </div>
);