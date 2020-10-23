const container = document.getElementById('viewer');

let options = {
    env: VIEWER_ENV,
    api: VIEWER_API,
    getAccessToken: function (callback) {
        callback(ACCESS_TOKEN, 3600);
    }
};

let viewer;
console.log('Calling viewer initializer...');
Autodesk.Viewing.Initializer(options, function () {
    viewer = new Autodesk.Viewing.Private.GuiViewer3D(container, VIEWER_CONFIG);
    viewer.start();
    console.log('Loading document...');
    Autodesk.Viewing.Document.load('urn:' + URN, onDocumentLoadSuccess, onDocumentLoadFailure);
});

function onDocumentLoadSuccess(doc) {
    console.log('Document loaded...');
    const node = doc.getRoot().findByGuid(GUID);
    if (node) {
        viewer.loadDocumentNode(doc, node);
    } else {
        container.classList.add('alert', 'alert-warning');
        container.innerText = 'Viewable not found';
    }
}

function onDocumentLoadFailure(err, msg) {
    console.log('Document loading failed...');
    container.classList.add('alert', 'alert-danger');
    container.innerText = `Document loading failed (${msg})`;
}
