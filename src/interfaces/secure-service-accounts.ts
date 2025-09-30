export interface ISecureServiceAccount {
    type: 'secure-service-account';
    id: string;
    email: string;
}

export interface ISecureServiceAccountKey {
    type: 'secure-service-account-key';
    id: string;
    status: string;
    secureServiceAccountId: string;
}
