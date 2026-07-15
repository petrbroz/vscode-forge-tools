/**
 * Encodes an OSS object ID as a base64 Model Derivative URN. Equivalent to the legacy `urnify`
 * helper from the legacy SDK (plain base64, not URL-safe) - callers that need a URL-safe variant
 * (e.g. for use as VS Code tree item/webview panel IDs) apply their own `.replace('/', '_')`.
 */
export function urnify(id: string): string {
    return Buffer.from(id).toString('base64');
}
