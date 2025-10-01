export enum EntryType {
    SecureServiceAccount = 'secure-service-account',
    SecureServiceAccountKey = 'secure-service-account-key'
}

export interface ISecureServiceAccount {
    type: EntryType.SecureServiceAccount;
    id: string;
    email: string;
}

export interface ISecureServiceAccountKey {
    type: EntryType.SecureServiceAccountKey;
    id: string;
    status: string;
    secureServiceAccountId: string;
}
