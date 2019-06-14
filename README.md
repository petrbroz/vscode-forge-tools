# vscode-forge-tools

[Visual Studio Code](https://code.visualstudio.com) extension for accessing [Autodesk Forge](https://forge.autodesk.com) services and content.

![Forge Tools](https://github.com/petrbroz/vscode-forge-tools/raw/develop/docs/vscode-forge-tools.gif)

## Features

### Data Management View

_Data Management_ view allows you to browse
[Forge Data Management](https://forge.autodesk.com/en/docs/data/v2/developers_guide/overview) content, create buckets, and upload/download objects. Individual objects and their 2D/3D derivatives can then be previewed in a simple webview.

### Design Automation View

_Design Automation_ can be used for browsing [Forge Design Automation](https://forge.autodesk.com/en/docs/design-automation/v2/developers_guide/overview) entities such as app bundles and activities. It also provides a context menu that can be used to view additinal details of individual bundles or activities.

## Requirements

- [Visual Studio Code](https://code.visualstudio.com) version 1.35.0 or newer
- Forge application credentials ([tutorial](https://forge.autodesk.com/en/docs/oauth/v2/tutorials/create-app))

## Extension Settings

This extension contributes the following settings:

* `autodesk.forge.clientId`: Forge application client ID
* `autodesk.forge.clientSecret`: Forge application client secret