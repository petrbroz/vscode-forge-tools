import * as vscode from 'vscode';
import { IContext } from '../common';
import { getEnvironments } from '../environment';
import { IEnvironment } from '../models/environment';

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
        // Only update the selected environment here; the refresh callback rebuilds the services for the
        // new environment and restores that environment's persisted session (see `activate`).
        this.context.environment = environments.find(environment => environment.title === name) as IEnvironment;
        this.refresh();
    }
}
