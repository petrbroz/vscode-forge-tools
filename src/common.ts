export function idToUrn(id: string) {
    return Buffer.from(id).toString('base64').replace(/=/, '');
}
