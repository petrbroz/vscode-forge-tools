const fs = require('node:fs');
const { build } = require('esbuild');

const baseConfig = {
    bundle: true,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production'
};

const extensionConfig = {
    ...baseConfig,
    platform: 'node',
    format: 'cjs',
    entryPoints: ['./src/extension.ts'],
    outfile: './out/extension.js',
    external: ['vscode']
};

const webviewsConfig = {
    ...baseConfig,
    target: 'es2020',
    format: 'esm',
    entryPoints: fs.readdirSync('./src/webviews')
        .filter(file => file.endsWith('.tsx'))
        .map(file => `./src/webviews/${file}`),
    outdir: './out/webviews',
    splitting: true
};

const scriptsConfig = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    entryPoints: ['./src/scripts/update-contributes.ts'],
    outfile: './scripts/update-contributes.js',
    alias: {
        'vscode': './vscode-shim.js'
    }
};

(async () => {
    try {
        await build(extensionConfig);
        await build(webviewsConfig);
        await build(scriptsConfig);
    } catch (err) {
        process.stderr.write(err.stderr);
        process.exit(1);
    }
})();
