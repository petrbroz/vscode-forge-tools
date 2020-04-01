const vscode = acquireVsCodeApi();

const clientId = document.getElementById('client-id');
const redirectUri = document.getElementById('redirect-uri');
const login = document.getElementById('login');
const iframe = document.querySelector('iframe');
login.addEventListener('click', () => {
    console.log('hit', iframe);
    const url = new URL('https://developer.api.autodesk.com/authentication/v1/authorize');
    url.searchParams.set('client_id', clientId.value);
    url.searchParams.set('redirect_uri', redirectUri.value);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('scope', 'data:read');
    iframe.src = url.toString();
});
