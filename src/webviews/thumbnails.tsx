import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from './components/controls';
import { postMessage } from './common';

function downloadThumbnail(size: IThumbnailsMessage['thumbnailSize']) {
    postMessage<IThumbnailsMessage>({
        command: 'download',
        thumbnailSize: size
    });
}

export type IThumbnailsMessage = {
    command: 'download';
    thumbnailSize: 'small' | 'medium' | 'large';
};

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
        <Button onClick={() => downloadThumbnail('small')}>Download</Button>
        <img src={smallDataURI} alt={objectKey} style={{ display: 'block' }} />

        <h2>200x200px</h2>
        <Button onClick={() => downloadThumbnail('medium')}>Download</Button>
        <img src={mediumDataURI} alt={objectKey} style={{ display: 'block' }} />

        <h2>400x400px</h2>
        <Button onClick={() => downloadThumbnail('large')}>Download</Button>
        <img src={largeDataURI} alt={objectKey} style={{ display: 'block' }} />
    </div>
);

export function render(container: HTMLElement, props: IThumbnailsProps) {
    ReactDOM.createRoot(container).render(<Thumbnails {...props} />);
}