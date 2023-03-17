// @ts-nocheck
import { postMessage } from './common';

export interface IDerivativePreviewProps {
    api: string;
    env: string;
    token: string;
    urn: string;
    guid?: string;
    config?: any;
}

export function render(container: HTMLElement, props: IDerivativePreviewProps) {
    const { api, env, token, urn, guid, config } = props;
    Autodesk.Viewing.Initializer({ api, env, accessToken: token }, function () {
        const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        Autodesk.Viewing.Document.load(
            'urn:' + urn,
            doc => viewer.loadDocumentNode(doc, guid ? doc.getRoot().findByGuid(guid) : doc.getRoot().getDefaultGeometry()),
            (code, message, errors) => postMessage({ type: 'error', error: { code, message, errors } }));
    });
}