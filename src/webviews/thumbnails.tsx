import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { postMessage } from './common';

function downloadThumbnail(size: string) {
    postMessage({
        command: 'download',
        thumbnailSize: size
    });
}

export interface IThumbnailsProps {
    objectKey: string;
    smallDataURI: string;
    mediumDataURI: string;
    largeDataURI: string;
}

const Thumbnails = ({ objectKey, smallDataURI, mediumDataURI, largeDataURI }: IThumbnailsProps) => (
    <div>
        <h1>Thumbnails: {objectKey}</h1>

        <h2>100x100px</h2>
        <VSCodeButton onClick={() => downloadThumbnail('small')}>Download</VSCodeButton>
        <img src={smallDataURI} alt={objectKey} style={{ display: 'block' }} />

        <h2>200x200px</h2>
        <VSCodeButton onClick={() => downloadThumbnail('medium')}>Download</VSCodeButton>
        <img src={mediumDataURI} alt={objectKey} style={{ display: 'block' }} />

        <h2>400x400px</h2>
        <VSCodeButton onClick={() => downloadThumbnail('large')}>Download</VSCodeButton>
        <img src={largeDataURI} alt={objectKey} style={{ display: 'block' }} />
    </div>
);

export function render(container: HTMLElement, props: IThumbnailsProps) {
    ReactDOM.createRoot(container).render(<Thumbnails {...props} />);
}