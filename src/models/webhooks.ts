export type { HookDetails } from '@aps_sdk/webhooks';

export interface WebhookSystem {
    id: string;
    name: string;
    events: WebhookEvent[];
}

export interface WebhookEvent {
    id: string;
    description: string;
    scopes: string[];
}

/** Which token identity a Webhooks tree node belongs to (the app-context vs user-context view). */
export type WebhookAuthContext = 'app' | 'user';

/** View-model for a webhook system node in the Webhooks tree. */
export interface IWebhookSystem {
    type: 'system';
    name: string;
    system: string;
    authContext: WebhookAuthContext;
}

/** View-model for a webhook event node in the Webhooks tree. */
export interface IWebhookEvent {
    type: 'event';
    name: string;
    system: string;
    event: string;
    authContext: WebhookAuthContext;
}

/** View-model for a webhook (hook) node in the Webhooks tree. */
export interface IWebhook {
    type: 'hook';
    id: string;
    system: string;
    event: string;
    authContext: WebhookAuthContext;
}

