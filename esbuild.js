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
        './src/webviews/custom-translation.tsx',
        './src/webviews/thumbnails.tsx',
        './src/webviews/webhook-details.tsx',
        './src/webviews/create-webhook.tsx',
        './src/webviews/update-webhook.tsx',
        './src/webviews/derivative-preview.tsx',
        './src/webviews/appbundle-details.tsx',
        './src/webviews/alias-details.tsx',
        './src/webviews/activity-details.tsx',
        './src/webviews/create-activity.tsx',
        './src/webviews/update-activity.tsx',
        './src/webviews/create-workitem.tsx'
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