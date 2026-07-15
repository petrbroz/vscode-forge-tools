import * as vscode from 'vscode';
import { IContext } from '../common';
import { getEnvironments, IEnvironment } from '../environment';
import { createClients } from '../clients';
import { CommandCategory, Command, CommandRegistry } from './shared';

@CommandCategory({ category: 'Autodesk Platform Services', prefix: 'aps' })
export class EnvironmentCommands extends CommandRegistry {
	constructor(protected context: IContext, protected refresh: () => void) {
		super();
	}

    @Command({ title: 'Switch Environment', icon: 'sync' })
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
        Object.assign(context, createClients(env));
        this.refresh();
    }
}
