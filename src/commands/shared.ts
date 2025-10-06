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

type CategoryMetadataPerClass = Map<Function, ICommandCategoryMetadata>;

/**
 * Map to store command category metadata for each class (keyed by class constructor)
 * @internal
 */
const categoryMetadataPerClass: CategoryMetadataPerClass = new Map();

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
        categoryMetadataPerClass.set(constructor, metadata);
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
}

type CommandMetadataPerClass = Map<Function, (ICommandMetadata & { methodName: string })[]>;

/**
 * Map to store commands for each class (keyed by class constructor)
 * @internal
 */
const commandMetadataPerClass: CommandMetadataPerClass = new Map();

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
        if (!commandMetadataPerClass.has(target.constructor)) {
            commandMetadataPerClass.set(target.constructor, []);
        }
        commandMetadataPerClass.get(target.constructor)!.push({ methodName: propertyKey, ...metadata });
        return descriptor; // Return the original descriptor (no modification needed)
    };
}

interface IMenuMetadata {
    when?: string;
    group?: string;
}

const viewTitleMenuMetadata: Map<Function, Map<string, IMenuMetadata[]>> = new Map();

export function ViewTitleMenu(metadata: IMenuMetadata) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        if (!viewTitleMenuMetadata.has(target.constructor)) {
            viewTitleMenuMetadata.set(target.constructor, new Map());
        }
        const tmp = viewTitleMenuMetadata.get(target.constructor)!;
        if (!tmp.has(propertyKey)) {
            tmp.set(propertyKey, []);
        }
        tmp.get(propertyKey)!.push(metadata);
        return descriptor; // Return the original descriptor (no modification needed)
    };
}

const viewItemContextMenuMetadata: Map<Function, Map<string, IMenuMetadata[]>> = new Map();

export function ViewItemContextMenu(metadata: IMenuMetadata) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        if (!viewItemContextMenuMetadata.has(target.constructor)) {
            viewItemContextMenuMetadata.set(target.constructor, new Map());
        }
        const tmp = viewItemContextMenuMetadata.get(target.constructor)!;
        if (!tmp.has(propertyKey)) {
            tmp.set(propertyKey, []);
        }
        tmp.get(propertyKey)!.push(metadata);
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
        const categoryMeta = categoryMetadataPerClass.get(this);
        const commandMetas = commandMetadataPerClass.get(this) || [];
        const _viewTitleMenuMetadata = viewTitleMenuMetadata.get(this);
        const _viewItemContextMenuMetadata = viewItemContextMenuMetadata.get(this);
        return commandMetas.map(commandMeta => ({
            command: {
                command: commandMeta.command || (categoryMeta?.prefix ? `${categoryMeta.prefix}.${commandMeta.methodName}` : commandMeta.methodName),
                title: commandMeta.title,
                category: categoryMeta?.category,
                icon: '$(' + commandMeta.icon + ')' // VS Code expects icons in the format '$(iconName)'
            },
            menus: {
                'view/title': _viewTitleMenuMetadata?.get(commandMeta.methodName),
                'view/item/context': _viewItemContextMenuMetadata?.get(commandMeta.methodName),
            }
        }));
    }

    /**
     * Registers all commands decorated with @Command in this registry.
     * This method should be called after the registry is instantiated.
     * All registered commands are automatically added to the extension context's subscriptions.
     */
    public registerCommands(): vscode.Disposable[] {
        const commands = commandMetadataPerClass.get(this.constructor) || [];
        return commands.map(cmd => {
            const method = (this as any)[cmd.methodName];

            if (typeof method !== 'function') {
                throw new Error(`Method '${cmd.methodName}' not found on ${this.constructor.name}`);
            }

            // Register the command, binding the method to this instance
            const commandId = cmd.command || (() => {
                const categoryMeta = categoryMetadataPerClass.get(this.constructor);
                return categoryMeta?.prefix ? `${categoryMeta.prefix}.${cmd.methodName}` : cmd.methodName;
            })();
            return vscode.commands.registerCommand(commandId, (...args: any[]) => {
                return method.apply(this, args);
            });
        });
    }
}
