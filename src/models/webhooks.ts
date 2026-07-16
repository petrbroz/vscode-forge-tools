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

/** View-model for a webhook system node in the Webhooks tree. */
export interface IWebhookSystem {
    type: 'system';
    name: string;
    system: string;
}

/** View-model for a webhook event node in the Webhooks tree. */
export interface IWebhookEvent {
    type: 'event';
    name: string;
    system: string;
    event: string;
}

/** View-model for a webhook (hook) node in the Webhooks tree. */
export interface IWebhook {
    type: 'hook';
    id: string;
    system: string;
    event: string;
}

