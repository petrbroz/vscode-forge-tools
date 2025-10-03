import * as vscode from 'vscode';

/**
 * Interface for command category metadata
 */
interface ICommandCategoryMetadata {
    /** The category name for commands in this class (e.g., 'Data Management') */
    category?: string;
    /** The prefix for command identifiers (e.g., 'aps.dm') */
    prefix?: string;
}

/**
 * Map to store command category metadata for each class (keyed by class constructor)
 * @internal
 */
const categoryMap: Map<Function, ICommandCategoryMetadata> = new Map();

/**
 * Class decorator to assign a category and prefix to all commands in a class.
 *
 * @param metadata Category metadata including category name and command prefix.
 * 
 * @example
 * ```typescript
 * @CommandCategory({ category: 'Data Management', prefix: 'aps.dm' })
 * class DataManagementCommands extends CommandRegistry {
 *     @Command({ title: 'List Buckets' })
 *     async listBuckets() {
 *         // Full command ID will be: aps.dm.listBuckets
 *     }
 * }
 * ```
 */
export function CommandCategory(metadata: { category?: string; prefix?: string; }) {
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        // Store the category metadata for this class
        categoryMap.set(constructor, metadata);
        return constructor;
    };
}

/**
 * Interface for command metadata
 */
interface ICommandMetadata {
    /** The command title (e.g., 'Say Hello') */
    title: string;
    /** The command identifier (if not provided, will be generated from the category prefix and method name) */
    command?: string;
    /** Optional icon name (e.g., 'refresh'); will be wrapped in '$()' */
    icon?: string;
    /** Optional menus for the command to be added to */
    menus?: {
        "view/title"?: { when?: string; group?: string; }[];
        "view/item/context"?: { when?: string; group?: string; }[];
    };
}

/**
 * Map to store commands for each class (keyed by class constructor)
 * @internal
 */
const commandsMap: Map<Function, (ICommandMetadata & { methodName: string })[]> = new Map();


/**
 * Decorator to mark a method as a VS Code command.
 * The decorated method will be automatically registered when `registerCommands()` is called.
 *
 * @param metadata Command metadata including command identifier, title, optional category, and optional icon.
 * 
 * @example
 * ```typescript
 * @CommandCategory({ category: 'Data Management', prefix: 'aps.dm' })
 * class DataManagementCommands extends CommandRegistry {
 *     @Command({ title: 'List Buckets' })
 *     async listBuckets() {
 *         // Full command ID will be: aps.dm.listBuckets
 *     }
 * }
 * ```
 */
export function Command(metadata: ICommandMetadata) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Store the command metadata for the target class
        if (!commandsMap.has(target.constructor)) {
            commandsMap.set(target.constructor, []);
        }
        commandsMap.get(target.constructor)!.push({ methodName: propertyKey, ...metadata });
        return descriptor; // Return the original descriptor (no modification needed)
    };
}

/**
 * Abstract base class for command registries.
 * Subclasses should use the @Command decorator on methods to mark them as VS Code commands.
 * 
 * Usage:
 * ```typescript
 * @CommandCategory({ category: 'Data Management', prefix: 'aps.dm' })
 * class DataManagementCommands extends CommandRegistry {
 *     @Command({ title: 'List Buckets' })
 *     async listBuckets() {
 *         // Full command ID will be: aps.dm.listBuckets
 *     }
 * }
 * 
 * // In extension.ts:
 * const dataManagementCommands = new DataManagementCommands();
 * dataManagementCommands.registerCommands();
 * ```
 */
export abstract class CommandRegistry {
    /**
     * Returns command contributions for this registry.
     * This method can be used to generate the `contributes.commands` section of package.json.
     */
    static contributes() {
        const categoryMeta = categoryMap.get(this);
        const commands = commandsMap.get(this) || [];
        return commands.map(cmd => ({
            command: {
                command: cmd.command || (categoryMeta?.prefix ? `${categoryMeta.prefix}.${cmd.methodName}` : cmd.methodName),
                title: cmd.title,
                category: categoryMeta?.category,
                icon: '$(' + cmd.icon + ')' // VS Code expects icons in the format '$(iconName)'
            },
            menus: cmd.menus
        }));
    }

    /**
     * Registers all commands decorated with @Command in this registry.
     * This method should be called after the registry is instantiated.
     * All registered commands are automatically added to the extension context's subscriptions.
     */
    public registerCommands(): vscode.Disposable[] {
        const commands = commandsMap.get(this.constructor) || [];
        return commands.map(cmd => {
            const method = (this as any)[cmd.methodName];

            if (typeof method !== 'function') {
                throw new Error(`Method '${cmd.methodName}' not found on ${this.constructor.name}`);
            }

            // Register the command, binding the method to this instance
            const commandId = cmd.command || (() => {
                const categoryMeta = categoryMap.get(this.constructor);
                return categoryMeta?.prefix ? `${categoryMeta.prefix}.${cmd.methodName}` : cmd.methodName;
            })();
            return vscode.commands.registerCommand(commandId, (...args: any[]) => {
                return method.apply(this, args);
            });
        });
    }
}
