# Autodesk Platform Services VSCode Extension

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/petrbroz.vscode-forge-tools.svg)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/petrbroz.vscode-forge-tools.svg)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/petrbroz.vscode-forge-tools.svg)
![platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](http://opensource.org/licenses/MIT)

[Visual Studio Code](https://code.visualstudio.com) extension for accessing [Autodesk Platform Services](https://aps.autodesk.com) services and content.

![Preview](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/screenshot.png)

> Note: _Autodesk Forge_ is now _Autodesk Platform Services_ but you may still see the _Forge_ reference in different areas
> when working with this extension. These references have been kept to prevent backwards compatibility issues.

## Requirements

- [Visual Studio Code](https://code.visualstudio.com) version 1.31.0 or newer
- [APS application credentials](https://aps.autodesk.com/en/docs/oauth/v2/tutorials/create-app)

## Getting Started

While in Visual Studio Code:

- Switch to the _Extensions_ sidebar (`Cmd`+`Shift`+`X` on macOS or `Ctrl`+`Shift`+`X` on Windows)
- Search for the _Autodesk Platform Services_ extension and install it
- Open _User Settings_ (`Cmd`+`,` on macOS or `Ctrl`+`,` on Windows), and search for _autodesk env_
  - Note: switch to _User_ or _Workspace_ tab depending on whether you want to persist the settings globally (for all instances of vscode) or locally (for a specific workspace/folder)
- In the _Autodesk > Forge: Environments_ section, click _Edit in settings.json_ and define one or more environments as explained in the [Extension Settings](##extension-settings) section below
- Switch to the new _Autodesk Platform Services_ sidebar and start browsing!

## Extension Settings

The extension exposes the following settings:

- `autodesk.forge.environments` - array of objects representing different APS applications or "environments"; each environment can specify the following properties:
  - `title` (required) - unique name of the application (will be shown in status bar and when switching to other applications)
  - `clientId` (required) - APS client ID
  - `clientSecret` (required) - APS client secret
  - `region` - data region for storing design data; can be `US` (default) or `EMEA`
- `autodesk.forge.authentication.port` - server port to use during 3-legged authentication workflows
- `autodesk.forge.data.defaultContentType` - content type to use for all files uploaded to OSS
- `autodesk.forge.data.uploadChunkSize` - size of individual chunks (in bytes) when uploading files to OSS with the resumable functionality
- `autodesk.forge.viewer.extensions` - array of Viewer [extensions](https://aps.autodesk.com/en/docs/viewer/v7/reference/Extensions) (for example, `Autodesk.VisualClusters` or `Autodesk.DocumentBrowser`) to be used when previewing derivatives
- `autodesk.forge.viewer.api` - API used by the viewer; by default, the viewer will determine the appropriate API based on the viewable output format (SVF vs SVF2)
- `autodesk.forge.viewer.env` - Environment used by the viewer; by default, the viewer will determine the appropriate environment based on the viewable output format (SVF vs SVF2)

Here's an example of an environment list:

![Extension Settings](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/extension-settings.png)

## Features

### APS Environments

If you have configured multiple APS environments, you can switch between them via status bar,
or using the `forge.switchEnvironment` command. The extension will always initialize itself
based on the _first_ environment in the list.

![Switch Environments](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/switch-environments.gif)

> Note: if you have configured the extension both in the _User_ scope and in the _Workspace_ scope,
the extension will present the list of environments from the _Workspace_ scope as it has higher precedence.

### Buckets & Derivatives View

The _Buckets & Derivatives_ view allows you to browse [Data Management](https://aps.autodesk.com/en/docs/data/v2/developers_guide/overview) OSS (object simple storage) content, create buckets, upload/download files, translate them using the [Model Derivative](https://aps.autodesk.com/en/docs/model-derivative/v2) service, and even access the generated derivatives. All derivatives are listed as children of their corresponding objects in the tree. If there are no derivatives yet, or if there's been an issue with the translation, the tree view will provide additional information.

![Create bucket and upload object](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/create-bucket-upload-file.gif)

![Translate object and view derivatives](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/translate-and-preview.gif)

For objects that have already been translated using the Model Derivative service, you can use a command (or a context menu item) called `Download Object Derivatives as SVF` which will download the SVF file (proprietary format used for viewing 3D content in the Viewer) and all its dependencies into a folder you pick,
similarly to the functionality provided by https://extract.autodesk.io. All the content will be stored using the following subfolder structure:

```
<output folder>/
    <model urn>/
        <viewable guid>/
            output.svf
            <additional files and subfolders>
        <viewable guid>/
            output.svf
            <additional files and subfolders>
    <files shared by all viewables>
```

Additional output formats are also supported, for example, F2D, or glTF.

### Hubs & Derivatives View

Experimental feature similar to the _Buckets & Derivatives_ view, but using a 3-legged authentication instead, allowing the user to browse their A360 hubs, BIM360 hubs, etc. In order for this view to be available, the user must first log into the currently active APS application with their Autodesk account. This can be done either by clicking the "APS Login" button in the bottom status bar, or by using the `forge.login` command. The extension will spin up a temporary web server on a preconfigured port (8123 by default), providing additional information about the login process, and waiting for a callback from the Autodesk servers.

### Webhooks View

The _Webhooks_ view can be used to browse and configure the [Webhooks](https://aps.autodesk.com/en/docs/webhooks/v1/developers_guide/overview) service.

### Design Automation View

The _Design Automation_ can be used for browsing [Design Automation](https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/overview) entities such as app bundles and activities. It also provides a context menu that can be used to view additinal details of individual bundles or activities.

![Design Automation Preview](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/design-automation-preview.gif)

## Known Limitations & Issues

### Derivatives in Custom Regions, and Status Code 406

The Model Derivative APIs support outputting the derivatives in a region of your choice.
In our code we always assume that the derivatives are stored in the same region as the input object.
Note that this can cause issues, for example, when you use the `Translate Object` or `Translate Object (Custom)`
command on an object for which the derivatives are already available in another region. In that case you will get
an error with status code 406, and you will need to delete the derivatives manually
(using the `Delete Derivatives` command) before being able to translate the object again.

## Development

- clone the repository
- install and setup dependencies: `yarn install`
- open the project in vscode and launch the _Launch Extension_ task; new vscode window will open
- make sure you have at least one set of APS credentials configured (see [Getting Started](#getting-started) and [Extension Settings](#extension-settings))
- click on the APS icon in the sidebar and start browsing

> When debugging a webview inside vscode, use the `Developer: Open Webview Developer Tools` and the `Developer: Reload Window` commands.