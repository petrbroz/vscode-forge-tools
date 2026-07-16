import { WebhooksClient, HookDetails } from '@aps_sdk/webhooks';
import { WebhookSystem, WebhookEvent } from '../models/webhooks';
import { WEBHOOKS } from './webhooks-catalog';

export interface ICreateWebhookOptions {
    callbackUrl: string;
    /** Scope key/value pair, e.g. `folder` -> `urn:...`. Shaped into the SDK's `scope` map internally. */
    scopeKey: string;
    scopeValue: string;
    filter?: string;
    /** Parsed hook attributes object (already deserialized from any user-provided JSON). */
    hookAttribute?: object;
}

export interface IUpdateWebhookOptions {
    filter?: string;
    /** Parsed hook attributes object (already deserialized from any user-provided JSON). */
    hookAttribute?: object;
}

/**
 * Domain logic for the Webhooks service. Wraps a `WebhooksClient` and exposes plain, domain-shaped
 * operations so the vscode layers never touch the SDK's clients or transforms.
 */
export class WebhooksService {
    constructor(private readonly client: WebhooksClient) {}

    /**
     * Lists every webhook registered for a given system/event. The SDK's `getSystemEventHooks`
     * returns a single page; this loops on the `next` page state to restore "list everything".
     */
    async getAllSystemEventHooks(system: string, event: string): Promise<HookDetails[]> {
        const results: HookDetails[] = [];
        let pageState: string | undefined;
        do {
            const page = await this.client.getSystemEventHooks(system, event, { pageState });
            results.push(...(page.data ?? []));
            pageState = page.links?.next;
        } while (pageState);
        return results;
    }

    /** Returns the scopes supported by a given system/event from the webhooks catalog. */
    getEventScopes(system: string, event: string): string[] {
        const _system = WEBHOOKS.find(webhook => webhook.id === system) as WebhookSystem;
        const _event = _system.events.find(ev => ev.id === event) as WebhookEvent;
        return _event.scopes;
    }

    getHookDetails(system: string, event: string, id: string): Promise<HookDetails> {
        return this.client.getHookDetails(system, event, id);
    }

    async createWebhook(system: string, event: string, options: ICreateWebhookOptions): Promise<void> {
        await this.client.createSystemEventHook(system, event, {
            callbackUrl: options.callbackUrl,
            scope: { [options.scopeKey]: options.scopeValue },
            filter: options.filter || undefined,
            hookAttribute: options.hookAttribute
        });
    }

    async updateWebhook(system: string, event: string, id: string, options: IUpdateWebhookOptions): Promise<void> {
        await this.client.patchSystemEventHook(system, event, id, {
            filter: options.filter || undefined,
            hookAttribute: options.hookAttribute
        });
    }

    async deleteWebhook(system: string, event: string, id: string): Promise<void> {
        await this.client.deleteSystemEventHook(system, event, id);
    }
}
