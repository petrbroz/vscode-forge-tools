export type { ThreeLeggedToken } from '@aps_sdk/authentication';
export type { ExchangeJwtToken } from '@aps_sdk/secure-service-account';

/**
 * The interactive/user-context sign-in mechanisms the extension supports. Plain 2-legged
 * (client-credentials) access is *not* a mode - it is the always-available app identity derived from
 * the environment's client ID/secret, and the absence of a session means "2-legged only".
 */
export type ApsAuthMode =
    | { kind: 'authorization-code' }                    // 3-legged OAuth, confidential client (client secret)
    | { kind: 'authorization-code-pkce' }               // 3-legged OAuth with PKCE, public client (no secret)
    | { kind: 'service-account'; serviceAccountId: string; keyId: string; privateKey: string } // Secure Service Account
    | { kind: 'manual-token' };                         // access token pasted from another APS app

export type ApsAuthModeKind = ApsAuthMode['kind'];

/**
 * A live user-context session. Persisted to `context.secrets`, keyed per environment, so it can be
 * silently resumed after a window reload. Holds the mode-specific secret material needed to re-mint or
 * refresh the token (refresh token for 3-legged/PKCE; private key inside `mode` for service accounts).
 */
export interface IApsAuthSession {
    id: string;                  // stable session id
    environmentKey: string;      // env.clientId this session belongs to
    mode: ApsAuthMode;
    scopes: string[];
    label: string;               // shown in the Accounts menu / status bar
    accessToken: string;
    expiresAt: number;           // epoch ms; 0 when the lifetime is unknown (manual-token)
    refreshToken?: string;       // authorization-code / pkce only
}
