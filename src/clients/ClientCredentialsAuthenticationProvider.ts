import { AuthenticationProvider, RequestInformation } from "@microsoft/kiota-abstractions";

const SCOPES = [
    "application:service_account:read",
    "application:service_account:write",
    "application:service_account_key:read",
    "application:service_account_key:write",
];

/**
 * Represents an authentication provider that uses OAuth client credentials.
 */
export class ClientCredentialsAuthenticationProvider implements AuthenticationProvider {
    private readonly clientId: string;
    private readonly clientSecret: string;

    constructor(clientId?: string, clientSecret?: string) {
        if (clientId && clientSecret) {
            this.clientId = clientId;
            this.clientSecret = clientSecret;
        } else if (process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET) {
            this.clientId = process.env.APS_CLIENT_ID;
            this.clientSecret = process.env.APS_CLIENT_SECRET;
        } else {
            throw new Error("Please provide a valid client ID and client secret");
        }
    }

    async authenticateRequest(request: RequestInformation, additionalAuthenticationContext?: Record<string, unknown>): Promise<void> {
        const accessToken = await this.generateAccessToken(this.clientId, this.clientSecret, SCOPES.join(" "));
        request.headers.set("Authorization", new Set(["Bearer " + accessToken]));
    }

    private async generateAccessToken(clientId: string, clientSecret: string, scopes: string): Promise<string> {
        const url = "https://developer.api.autodesk.com/authentication/v2/token";
        const body = new URLSearchParams();
        body.append("client_id", clientId);
        body.append("client_secret", clientSecret);
        body.append("grant_type", "client_credentials");
        body.append("scope", scopes);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString()
        });
        if (!response.ok) {
            throw new Error("Failed to generate access token");
        }
        const data = await response.json() as any;
        return data.access_token;
    }
}
