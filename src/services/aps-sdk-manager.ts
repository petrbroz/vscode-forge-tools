import { ApsConfiguration, SdkManager, SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

/**
 * Builds an `SdkManager` pointed at a custom APS host, or `undefined` to let `@aps_sdk/*`
 * clients fall back to their built-in production default (https://developer.api.autodesk.com).
 */
export function createApsSdkManager(host?: string): SdkManager | undefined {
    if (!host) {
        return undefined;
    }
    const apsConfiguration = new ApsConfiguration({});
    apsConfiguration.BaseAddress = new URL(host);
    return SdkManagerBuilder.create().addApsConfiguration(apsConfiguration).build();
}
