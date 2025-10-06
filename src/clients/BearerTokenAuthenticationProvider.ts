import { AuthenticationProvider, RequestInformation } from "@microsoft/kiota-abstractions";

/**
 * Represents an authentication provider that uses a hard-coded bearer token.
 */
export class BearerTokenAuthenticationProvider implements AuthenticationProvider {
    private readonly accessToken: string;

    /**
     * Initializes a new instance of the BearerTokenAuthenticationProvider class.
     * @param accessToken The access token to use for authentication. If not provided, it will attempt to use the APS_ACCESS_TOKEN environment variable.
     * @throws Error if a valid access token is not provided.
     */
    constructor(accessToken?: string) {
        if (accessToken) {
            this.accessToken = accessToken;
        } else if (process.env.APS_ACCESS_TOKEN) {
            this.accessToken = process.env.APS_ACCESS_TOKEN;
        } else {
            throw new Error("Please provide a valid access token");
        }
    }

    /**
     * Authenticates the request by adding the bearer token to the request headers.
     * @param request The request information.
     * @param additionalAuthenticationContext Additional authentication context, if any.
     * @returns A Promise that resolves when the authentication is complete.
     */
    async authenticateRequest(request: RequestInformation, additionalAuthenticationContext?: Record<string, unknown>): Promise<void> {
        request.headers.set("Authorization", new Set(["Bearer " + this.accessToken]));
    }
}