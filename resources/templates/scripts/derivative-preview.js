const container = document.getElementById('viewer');

const options = {
    env: 'AutodeskProduction',
    getAccessToken: function (callback) {
        callback(ACCESS_TOKEN, 3600);
    }
};

let viewer;
Autodesk.Viewing.Initializer(options, function () {
    viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);
    viewer.start();
    Autodesk.Viewing.Document.load('urn:' + URN, onDocumentLoadSuccess, onDocumentLoadFailure);
});

function onDocumentLoadSuccess(doc) {
    const node = doc.getRoot().findByGuid(GUID);
    if (node) {
        viewer.loadDocumentNode(doc, node);
    } else {
        container.classList.add('alert', 'alert-warning');
        container.innerText = 'Viewable not found';
    }
}

function onDocumentLoadFailure(err, msg) {
    container.classList.add('alert', 'alert-danger');
    container.innerText = `Document loading failed (${msg})`;
}
