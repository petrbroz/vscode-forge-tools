import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';

export function idToUrn(id: string) {
    return Buffer.from(id).toString('base64').replace(/=/, '');
}

export class TemplateEngine {
    private _context: vscode.ExtensionContext;
    private _cache: Map<string, ejs.TemplateFunction>;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._cache = new Map();
    }

    render(templateName: string, data: ejs.Data): string {
        if (!this._cache.has(templateName)) {
            const templatePath = this._context.asAbsolutePath(path.join('resources', 'templates', templateName + '.ejs'));
            const template = fs.readFileSync(templatePath, { encoding: 'utf8' });
            this._cache.set(templateName, ejs.compile(template));
        }
        const func = this._cache.get(templateName);
        if (!func) {
            throw new Error('Unknown template: ' + templateName);
        }
        return func(data);
    }
}
