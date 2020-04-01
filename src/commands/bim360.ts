import * as vscode from 'vscode';
import { IContext } from '../common';

export async function login(clientId: string, redirectUri: string, context: IContext) {
    const panel = vscode.window.createWebviewPanel(
        'bim360-login',
        'BIM360 Login',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    panel.webview.html = context.templateEngine.render('bim360-login', { clientId, redirectUri });
}
