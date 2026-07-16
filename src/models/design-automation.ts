interface IDesignAutomationEntry {
    label: string;
}

export interface ISharedAppBundlesEntry extends IDesignAutomationEntry {
    type: 'shared-appbundles';
}

export interface ISharedAppBundleEntry extends IDesignAutomationEntry {
    type: 'shared-appbundle';
    fullid: string;
}

export interface IOwnedAppBundlesEntry extends IDesignAutomationEntry {
    type: 'owned-appbundles';
}

export interface IAppBundleEntry extends IDesignAutomationEntry {
    type: 'owned-appbundle';
    client: string;
    appbundle: string;
}

export interface IAppBundleAliasesEntry extends IDesignAutomationEntry {
    type: 'appbundle-aliases';
    client: string;
    appbundle: string;
}

export interface IAppBundleAliasEntry extends IDesignAutomationEntry {
    type: 'appbundle-alias';
    client: string;
    appbundle: string;
    alias: string;
    version: number;
}

export interface IAppBundleVersionsEntry extends IDesignAutomationEntry {
    type: 'appbundle-versions';
    client: string;
    appbundle: string;
}

export interface IAppBundleVersionEntry extends IDesignAutomationEntry {
    type: 'appbundle-version';
    client: string;
    appbundle: string;
    version: number;
}

export interface ISharedActivitiesEntry extends IDesignAutomationEntry {
    type: 'shared-activities';
}

export interface ISharedActivityEntry extends IDesignAutomationEntry {
    type: 'shared-activity';
    fullid: string;
}

export interface IOwnedActivitiesEntry extends IDesignAutomationEntry {
    type: 'owned-activities';
}

export interface IActivityEntry extends IDesignAutomationEntry {
    type: 'owned-activity';
    client: string;
    activity: string;
}

export interface IActivityAliasesEntry extends IDesignAutomationEntry {
    type: 'activity-aliases';
    client: string;
    activity: string;
}

export interface IActivityAliasEntry extends IDesignAutomationEntry {
    type: 'activity-alias';
    client: string;
    activity: string;
    alias: string;
    version: number;
}

export interface IActivityVersionsEntry extends IDesignAutomationEntry {
    type: 'activity-versions';
    client: string;
    activity: string;
}

export interface IActivityVersionEntry extends IDesignAutomationEntry {
    type: 'activity-version';
    client: string;
    activity: string;
    version: number;
}
