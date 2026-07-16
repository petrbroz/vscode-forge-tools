export enum DesignAutomationRegion {
    US_WEST = 'us-west',
    US_EAST = 'us-east'
}

export interface IEnvironment {
    title: string;
    clientId: string;
    clientSecret: string;
    region?: string;
    host?: string;
    designAutomationRegion?: string;
}
