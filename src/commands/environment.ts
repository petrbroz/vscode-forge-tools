import * as vscode from 'vscode';
import { IContext } from '../common';
import { getEnvironments, LAST_ENVIRONMENT_KEY } from '../environment';
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
        // List the currently active environment first, as a visual default for the common case of just confirming it.
        const titles = environments.map(env => env.title);
        const currentTitle = this.context.environment.title;
        if (titles.includes(currentTitle)) {
            titles.splice(titles.indexOf(currentTitle), 1);
            titles.unshift(currentTitle);
        }
        const name = await vscode.window.showQuickPick(titles, { placeHolder: 'Select APS environment' });
        if (!name) {
            return;
        }
        // Only update the selected environment here; the refresh callback rebuilds the services for the
        // new environment and restores that environment's persisted session (see `activate`).
        this.context.environment = environments.find(environment => environment.title === name) as IEnvironment;
        // Remembered per workspace so the next session in this workspace starts on the same environment (see `pickDefaultEnvironment`).
        await this.context.extensionContext.workspaceState.update(LAST_ENVIRONMENT_KEY, name);
        this.refresh();
    }
}
