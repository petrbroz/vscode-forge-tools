import * as React from 'react';

interface IGridProps {
    columns?: string;
    children: React.ReactNode[];
}

export const Grid = ({ children, columns }: IGridProps) => (
    <div style={{ display: 'grid', gap: '1em', gridTemplateColumns: columns, alignItems: 'end' }}>
        {children}
    </div>
);