import * as vscode from 'vscode';
import { IContext } from '../common';

/**
 * Abstract base class for command registries.
 * Subclasses should use the @Command decorator on methods to mark them as VS Code commands.
 * 
 * Usage:
 * ```typescript
 * class MyCommands extends CommandRegistry {
 *     constructor(context: IContext, refresh: () => void) {
 *         super(context, refresh);
 *     }
 * 
 *     @Command('My Command Description')
 *     async myCommand(arg1: any) {
 *         // command implementation
 *         this.refresh(); // call refresh if needed
 *     }
 * }
 * 
 * // In extension.ts:
 * const myCommands = new MyCommands(context, () => dataProvider.refresh());
 * myCommands.registerCommands();
 * ```
 */
export abstract class CommandRegistry {
    /** Map to store commands for each class (keyed by class constructor) */
    private static commandsMap: Map<Function, ICommandMetadata[]> = new Map();

    /**
     * Adds a command to the registry for a specific class.
     * This is used internally by the @Command decorator.
     * @internal
     */
    static addCommand(targetClass: Function, metadata: ICommandMetadata): void {
        if (!CommandRegistry.commandsMap.has(targetClass)) {
            CommandRegistry.commandsMap.set(targetClass, []);
        }
        CommandRegistry.commandsMap.get(targetClass)!.push(metadata);
    }

    /** Array of registered disposables */
    private disposables: vscode.Disposable[] = [];

    /**
     * Creates a new command registry
     * @param prefix The command prefix (e.g., 'aps.dm')
     * @param category The command category (e.g., 'Data Management')
     * @param context The extension context
     * @param refresh Callback function to refresh UI after command execution
     */
    constructor(protected prefix: string, protected category: string, protected context: IContext, protected refresh: () => void) {
    }

    /**
     * Registers all commands decorated with @Command in this registry.
     * This method should be called after the registry is instantiated.
     * All registered commands are automatically added to the extension context's subscriptions.
     */
    public registerCommands(): void {
        const commands = CommandRegistry.commandsMap.get(this.constructor) || [];
        for (const command of commands) {
            const disposable = this.registerCommand(command.methodName);
            this.disposables.push(disposable);
            this.context.extensionContext.subscriptions.push(disposable);
        }
    }

    /**
     * Registers a single command.
     * @param methodName The name of the method to call
     * @returns The disposable for the registered command
     */
    protected registerCommand(methodName: string): vscode.Disposable {
        const method = (this as any)[methodName];

        if (typeof method !== 'function') {
            throw new Error(`Method '${methodName}' not found on ${this.constructor.name}`);
        }

        // Register the command, binding the method to this instance
        return vscode.commands.registerCommand(`${this.prefix}.${methodName}`, (...args: any[]) => {
            return method.apply(this, args);
        });
    }

    /**
     * Disposes all registered commands.
     * This is automatically called when the extension is deactivated if the registry
     * is added to the extension context subscriptions.
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}

/**
 * Interface for command metadata
 */
export interface ICommandMetadata {
    /** The method name that implements this command */
    methodName: string;
    /** The command description */
    description: string;
    /** Optional icon name */
    icon?: string;
}

/**
 * Decorator to mark a method as a VS Code command.
 * The decorated method will be automatically registered when `registerCommands()` is called.
 * 
 * @param commandId - The VS Code command identifier (e.g., 'forge.refreshBuckets')
 * @param description - A description of what the command does
 * @param icon - (Optional) An icon name for the command
 * (e.g., 'refresh' which will be interpreted as 'resources/icons/dark/refresh.svg' and 'resources/icons/light/refresh.svg')
 * 
 * @example
 * ```typescript
 * class MyCommands extends CommandRegistry {
 *     @Command('Says hello to the user')
 *     async sayHello() {
 *         vscode.window.showInformationMessage('Hello!');
 *     }
 * }
 * ```
 */
export function Command(description: string, icon?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Store the command metadata for the target class
        CommandRegistry.addCommand(target.constructor, {
            methodName: propertyKey,
            description,
            icon
        });

        // Return the original descriptor (no modification needed)
        return descriptor;
    };
}
