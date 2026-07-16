import * as vscode from 'vscode';
import { IContext } from '../common';
import { getEnvironments } from '../environment';
import { IEnvironment } from '../models/environment';
import { createServices } from '../services';

export class EnvironmentCommands {
	constructor(protected context: IContext, protected refresh: () => void) {
	}

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('aps.switchEnvironment', this.switchEnvironment.bind(this)),
        ];
    }

    async switchEnvironment() {
        const environments = getEnvironments();
        const name = await vscode.window.showQuickPick(environments.map(env => env.title), { placeHolder: 'Select APS environment' });
        if (!name) {
            return;
        }
        const context = this.context;
        const env = environments.find(environment => environment.title === name) as IEnvironment;
        delete context.threeLeggedToken;
        context.environment = env;
        Object.assign(context, createServices(env));
        this.refresh();
    }
}
