// import { readJson, writeJson } from 'fs-extra';
// import { SecureServiceAccountsCommands } from '../commands/secure-service-accounts';

// export async function update(inputPath: string, outputPath: string) {
//     const pkg: any = await readJson(inputPath);
//     pkg.contributes = pkg.contributes || {};
//     pkg.contributes.commands = pkg.contributes.commands || [];
//     pkg.contributes.commands.push(...SecureServiceAccountsCommands);
//     await writeJson(outputPath, pkg, { spaces: 4 });
// }
