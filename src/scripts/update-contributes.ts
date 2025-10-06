import { readJson, writeJson } from 'fs-extra';
import { AuthenticationCommands } from '../commands/authentication';
import { ObjectStorageServiceCommands } from '../commands/object-storage';
import { DataManagementCommands } from '../commands/data-management';
import { ModelDerivativesCommands } from '../commands/model-derivative';
import { WebhooksCommands } from '../commands/webhooks';
import { SecureServiceAccountsCommands } from '../commands/secure-service-accounts';
import { EnvironmentCommands } from '../commands/environment';
import { DesignAutomationCommands } from '../commands/design-automation';

/**
 * Updates a VS Code extension's package.json with contributed commands and menus.
 * 
 * This function reads a package.json file, adds command definitions and menu contributions
 * from registered command sources, and writes the updated configuration to an output file.
 * 
 * @param inputPath - Path to the input package.json file to be processed
 * @param outputPath - Path where the updated package.json should be written
 */
export async function update(inputPath: string, outputPath: string) {
    // Read the package.json file
    const pkg: any = await readJson(inputPath);

    // Initialize the contributes section and its subsections if they don't exist
    pkg.contributes ||= {};
    pkg.contributes.commands ||= [];
    pkg.contributes.menus ||= {};
    pkg.contributes.menus['view/title'] ||= [];
    pkg.contributes.menus['view/item/context'] ||= [];

    // Collect all commands from registered command sources
    const contributes = [
        ...EnvironmentCommands.contributes(),
        ...AuthenticationCommands.contributes(),
        ...ObjectStorageServiceCommands.contributes(),
        ...DataManagementCommands.contributes(),
        ...ModelDerivativesCommands.contributes(),
        ...WebhooksCommands.contributes(),
        ...DesignAutomationCommands.contributes(),
        ...SecureServiceAccountsCommands.contributes(),
    ];

    // Process each command and add it to the appropriate sections
    for (const { command, menus } of contributes) {
        // Add command definition to the commands array
        pkg.contributes.commands.push(command);

        // Add to view title menu (e.g., toolbar buttons in view headers)
        if (menus && menus['view/title']) {
            pkg.contributes.menus['view/title'].push(...menus['view/title'].map(({ when, group }) => ({ command: command.command, when, group })));
        }

        // Add to view item context menu (e.g., right-click menu items on tree view items)
        if (menus && menus['view/item/context']) {
            pkg.contributes.menus['view/item/context'].push(...menus['view/item/context'].map(({ when, group }) => ({ command: command.command, when, group })));
        }
    }

    // Write the updated package.json to the output file with 4-space indentation
    await writeJson(outputPath, pkg, { spaces: 4 });
}

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.error('Usage: node update-contributes.js <inputPath> <outputPath>');
    process.exit(1);
}
update(inputPath, outputPath).catch(err => {
    console.error('Error updating package.json:', err);
    process.exit(1);
});
