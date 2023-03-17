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
    entryPoints: [
        './src/webviews/bucket-details.tsx',
        './src/webviews/object-details.tsx',
    ],
    outdir: './out/webviews',
    splitting: true
};

(async () => {
    try {
        await build(extensionConfig);
        await build(webviewsConfig);
    } catch (err) {
        process.stderr.write(err.stderr);
        process.exit(1);
    }
})();