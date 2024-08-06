# Changelog

All notable changes to the "vscode-forge-tools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.7.0] - 2024-08-06

- Added
  - Display versions next to DA bundle and activity aliases (https://github.com/petrbroz/vscode-forge-tools/issues/89)
  - Debugging information logged into a custom output channel
- Fixed
  - Creation of empty OSS objects (https://github.com/petrbroz/vscode-forge-tools/issues/90)
- Updated
  - Moved to vscode API version [1.92](https://code.visualstudio.com/updates/v1_92)

## [2.6.2] - 2024-05-03

- Fixed
  - Bug in SVF/glTF downloads after switching to another environment
  - Issue with 3-legged OAuth callback

## [2.6.1] - 2024-04-11

- Fixed
  - Bug in SVF/glTF downloads

## [2.6.0] - 2024-04-10

- Added
  - Sorting the list of Design Automatin engines (kudos to [CADBIMDeveloper](https://github.com/CADBIMDeveloper)!)
  - Users can now convert designs into derivatives other than just SVF or SVF2, and download them (kudos to [CADBIMDeveloper](https://github.com/CADBIMDeveloper)!)
- Fixed
  - Broken previewing of Fusion 360 designs (because of their GUIDs containing JSON data)
- Changed
  - Moved to the latest (unofficial) APS SDK that has been updated for Auth v2 API

## [2.5.2] - 2023-04-04

- Added
  - Support for retrieving information about DA app bundles and activities in raw JSON
- Fixed
  - Specifying string settings when creating a DA activity (thanks for the heads up [MadhukarMoogala](https://github.com/orgs/autodesk-platform-services/people/MadhukarMoogala)!)

## [2.5.1] - 2023-03-28

- Added
  - New command for retrieving list of viewables for specific URN as JSON
- Changed
  - Centralized some of the common UI elements (grids, action buttons) for consistent look&feel
- Fixed
  - Retrieving derivative tree or metadata for 2D views generated from Revit designs

## [2.5.0] - 2023-03-20

- Changed
  - (**MAJOR**) All custom webviews are now using the [vscode-webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- Added
  - Copying bucket and object keys into clipboard

## [2.4.1] - 2023-03-10

- Changed
  - Updated dependencies

## [2.4.0] - 2023-03-07

- Changed
  - Branding from Autodesk Forge to Autodesk Platform Services
  - Updated npm dependencies
  - Switched to SVF2 as the default output format

## [2.3.4] - 2022-03-24

- Removed
  - Support for the (experimental) OTG format download

## [2.3.3] - 2021-11-04

- Fixed
  - Failing SVF download when viewables contain special characters

## [2.3.2] - 2021-11-02

- Added
  - Support for sharing DA app bundle or activity aliases with other Forge apps
  - Retrieving details of a specific DA alias (for both app bundles and activities)

## [2.3.1] - 2021-06-03

- Added
  - When renaming OSS objects, a popup dialog informs why derivatives of that object are not available anymore (and how to resolve that situation)
- Fixed
  - Design Automation activity now extracts "settings" from the UI properly
  - Auto-generated command lines for Design Automation activities now quote all params

## [2.3.0] - 2021-03-19

- Added
  - Support for various commands in the "Hubs & Derivatives" tree (kudos to [smorel](https://github.com/smorel)!)

## [2.2.3] - 2021-01-04

- Added
  - Support for multiline settings in Design Automation activities
- Fixed
  - Various forms with user inputs (for example, when creating Design Automation activities) now retain their context even when the tab is hidden

## [2.2.2] - 2020-11-09

- Added
  - Theme icons for OSS, Webhooks, and Design Automation tree views
  - Button for manual refresh of the Webhookks tree view
- Fixed
  - Refreshing webhooks after switching to another environment

## [2.2.1] - 2020-11-02

- Added
  - Support for workflow IDs and attributes (used by Forge Webhooks) in the `Translate Object (Custom)` command.
  - Support for "read" verb in Design Automation work items (kudos https://github.com/mivasi).
- Fixed
  - Issue with creating a webhook with no attribute data.
  - Unhandled exception when trying to translate an object which has its derivatives available in another region
    - Note that cross-region derivatives are not supported by the extension (see https://github.com/petrbroz/vscode-forge-tools#derivatives-in-custom-regions-and-status-code-406 for more info)

## [2.2.0] - 2020-10-23

- Added
  - Support for [SVF2](https://forge.autodesk.com/blog/svf2-public-beta-new-optimized-viewer-format)
    - The `Translate Object (Custom)` command now supports choosing SVF or SVF2 as the output format
    - The `Preview Derivative` command now configures the viewer's `env` and `api` based on whether the derivative is an SVF or an SVF2
    - The viewer's `env` and `api` properties can be overridden using new configuration properties: `autodesk.forge.viewer.env` and `autodesk.forge.viewer.api`
- Fixed
  - Removed double url-encoding of uploaded objects' names (now handled by the Forge SDK library)

## [2.1.0] - 2020-09-04

- Changed
  - When a Forge API call fails, the `Show Details` option in the error popup now shows full HTTP response
  - Updated 3rd party dependencies to clear audit warnings
- Added
  - When an object is uploaded to OSS, user can immediately start its translation from the notification popup
  - New command (`Forge Authentication: Generate Access Token`) to generate a 2-legged token for a specific set of scopes

## [2.0.2] - 2020-08-12

- Changed
  - Moved to latest version of https://github.com/petrbroz/forge-server-utils

## [2.0.1] - 2020-06-12

- Changed
  - Hidden/internal folders in the _Hubs & Derivatives_ view are now prefixed with "(hidden)"
  - When downloading derivatives in glTF format, the main folder is now named after the OSS object ([#27](https://github.com/petrbroz/vscode-forge-tools/issues/27))
- Added
  - New settings option: `autodesk.forge.data.defaultContentType` (default: `application/octet-stream`)
    - When non-empty, all uploaded files and created objects in OSS will use this setting as their content type
  - Support for uploading multiple files to OSS at once ([#24](https://github.com/petrbroz/vscode-forge-tools/issues/24))
  - Size of file chunks for the resumable upload to OSS can now be configured
- Fixed
  - Reuploading the same file to OSS after it was deleted now works properly
    - This workflow was broken due to the resumable upload feature

## [2.0.0] - 2020-06-09

- Changed
  - The extension is now bundled with webpack, improving the installation and load times
    - Pug templates are now precompiled during the build process
  - Download of derivatives in glb/Draco format no longer supported
    - The feature has been removed due to the excessive size of the `gltf-pipeline` dependency
  - Where applicable, error notifications now provide a "Details" button that will display error details in a separate document
- Fixed
  - When a Forge environment is auto-configured for the first time, it is saved globally, avoiding issues when no workspace is open
  - Fixed typo in auto-generated Design Automation activity command lines

## [1.6.2] - 2020-04-24

- Changed
  - JSON data coming from Model Derivative service is now prettified to enable syntax highlighting, collapsing,
  and other vscode goodies
- Fixed
  - Webhook UI can now create/edit webhooks again (kudos to https://github.com/adamenagy)

## [1.6.1] - 2020-04-02

- Added
  - Support for 2-legged hubs browsing (kudos [jhoogeboom](https://github.com/jhoogeboom)!)
- Fixed
  - Npm audit warnings, cleaning up dependencies

## [1.6.0] - 2020-04-01

- Added
  - Basic support for 3-legged authentication, by running a temporary web server (port can be configured, by default 8123)
  and generating an [implicit token](https://forge.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-implicit/)
  - Basic support for browsing [Data Management](https://forge.autodesk.com/en/docs/data/v2/developers_guide/overview/) hubs,
  projects, folders, items, and versions
  - Support for previewing versions of items from hubs
  - Support for getting tree/property JSONs of versions of items from hubs

## [1.5.1] - 2020-03-24

- Fixed
  - Colors of meshes when converting DWG models to glTF

## [1.5.0] - 2020-03-13

- Added
  - Support for downloading OTG

## [1.4.11] - 2020-01-28

- Added
  - Design automation activities can now specify string/url settings (kudos to [@mivasi](https://github.com/mivasi))

## [1.4.10] - 2020-01-27

- Changed
  - Design Automation activities can now be created without appbundles (thanks [@mivasi](https://github.com/mivasi)!)
  - Design Automation work items can now be triggered multiple times form the same tab (thanks [@mivasi](https://github.com/mivasi)!)

## [1.4.9] - 2020-01-14

- Added
  - Experimental support for downloading F2D derivatives
  - New configuration option: viewer extensions to be used when previewing derivatives
- Changed
  - Moved to viewer version 7.9.* (currently with a small hack
  to disable writing to `document.cookie` before it's fixed on the viewer side)

## [1.4.8] - 2019-12-11

- Fixed
  - Advanced translation now passing parameters the right way (thanks @jaimerosales!)

## [1.4.7] - 2019-12-10

- Fixed
  - DA appBundles and activities now separated into shared/owned properly using nicknames

## [1.4.6] - 2019-11-26

- Added
  - Show progress when retrieving Model Derivative tree or properties
- Changed
  - Forced request of large MD tree or properties (introduced in previous release)
  is now downloaded to a local file instead of being open in a new document tab
  (vscode limits the document size to 50MB)
- Fixed
  - When switching to another environment, Design Automation tree is now updated properly

## [1.4.5] - 2019-11-20

- Added
  - Configurable Forge host
  - Configurable Design Automation availability region (thanks [@mivasi](https://github.com/mivasi)!)
  - Force download of derivative tree or props that are too large

## [1.4.4] - 2019-11-15

- Changed
  - Styling of various webviews now more consistent, and reusing more of vscode theme variables
- Fixed
  - URL-encode OSS object names

## [1.4.3] - 2019-11-13

- Changed
  - Model Derivative manifests, props, and trees are now open as raw JSONs
  - Instead of "Translate Object as ZIP", there's now a "Translate Object (Advanced)";
  this option opens a webview where additional translation properties can be configured
- Added
  - Support for configuring advanced properties (such as `switchLoader` and `generateMasterViews`)
  when starting a custom Model Derivative translation job

## [1.4.2] - 2019-11-04

- Added
  - Button for refreshing design automation tree
- Fixed
  - Warnings from the 'crypto' node.js module

## [1.4.1] - 2019-11-01

- Added
  - Command and menu item for copying URN of an object to clipboard
- Changed
  - Context menu items now organized in various groups for easier navigation (until vscode API adds support for sub-menus)

## [1.4.0] - 2019-10-22

- Added
  - Support for downloadong derivatives as glb (glTF binary format) with Draco compression
  - Default sorting of OSS and webhook entries in the tree view.
  - When running the extension for first time, offer a guided process for configuring new environment using vscode UI
- Fixed
  - When downloading an SVF and certain assets cannot be accessed, issue a warning and continue

## [1.3.0] - 2019-10-17

- Added
  - Additional webhook properties: filter, hookAttribute
  - Deleting buckets

## [1.2.0] - 2019-10-09

- Added
  - Listing, creating, updating, and deleting webhooks
  - Viewing details of a webhook

## [1.1.0] - 2019-10-07

- Added
  - Downloading & converting derivatives to glTF format

## [1.0.0] - 2019-09-30

- V1 as first feature complete release

## [0.14.1] - 2019-09-25

- Fixed
  - Issues when previewing f3d files

## [0.14.0] - 2019-09-19

- Added
  - Support for downloading SVF derivatives
  - After downloading an OSS object, the notification window provides a button
  for opening the file (using the default application)

## [0.13.1] - 2019-09-16

- Fixed
  - The "Windows upload fix" has been re-introduced

## [0.13.0] - 2019-09-12

- Added
  - Support for copying objects within bucket
  - Support for renaming objects

## [0.12.2] - 2019-09-12

- Added
  - Warning when uploading objects without file extension
- Fixed
  - File uploading on Windows platform

## [0.12.1] - 2019-09-03

- Added
  - Helper button for pre-generating initial command structure for DA activities
- Fixed
  - Styling of different web views to better follow vscode themes

## [0.12.0] - 2019-09-03

- Changed
  - Moved to new version of forge-server-utils
- Added
  - Activities can now specify multiple CLI commands and app bundles
  - Activity params can now specify additional fields (_required_, _zip_, and _on demand_)
  - Workitem arguments can now specify additional fields (_verb_, _optional_, _local name_, _path in zip_, and _headers_)

## [0.11.1] - 2019-09-02

- Changed
  - Styling of the UI for creating activities
- Fixed
  - Collection of inputs/outputs for DA workitems

## [0.11.0] - 2019-09-02

- Added
  - Support for creating and modifying DA activities
  - Basic support for running DA workitems
  - Error reports now include more information, incl. server responses
- Changed
  - All "preview" webviews now use a consistent look

## [0.10.1] - 2019-08-30

- Fixed
  - When switching environments, the auth. client that generates tokens for the viewer
  is now updated as well

## [0.10.0] - 2019-08-30

- Added
  - Support for creating empty OSS objects (for use with signed URLs and Design Automation)
  - Support for creating and modifying app bundles (incl. uploading their zip archives)
- Changed
  - There are now two separate actions for translating objects:
    1. `Translate Object` will simply start translation without any additional prompts
    2. `Translate Object as Zip` will assume the object is a zip archive,
    asking for filename of the root design in the archive
  - Updated npm dependencies

## [0.9.0] - 2019-08-22

- Added
  - Previewing and downloading of derivative thumbnails
  - Deleting model derivatives

## [0.8.0] - 2019-08-21

- Added
  - Deleting all objects in bucket
- Changed
  - Moved to new version of forge-server-utils
  - All commands can now be triggered via Command Palette, not just from the Tree View
    - Note: for now, the commands are not available until the extension is activated,
    that is, until you open the Forge tools in vscode sidebar

## [0.7.0] - 2019-08-01

- Changed
  - Moved to new version of forge-server-utils
  - Moved to Forge Viewer v7.0

## [0.6.0] - 2019-07-19

- Added
  - Auto-refresh tree view when translating objects
  - Generating signed URLs for uploaded objects
  - Viewing object manifests
- Fixed
  - Error when viewing properties of objects with no properties.

## [0.5.1] - 2019-07-18

- Changed
  - Naming of "Data & Derivatives" in the UI and related content in README

## [0.5.0] - 2019-07-17

- Changed
  - Objects in the tree view now list derivatives (if there are any) as their children in the tree
    - If no derivatives are available yet, or if the translation failed, the tree view provides additional information
  - Objects can no longer be _previewed_; they can be _translated_ (`Translate` menu item), and their resulting derivatives can then be _previewed_ (`Preview` menu item)
    - Note: `Translate` will always force a new translation, even if derivatives already exist

- Added
  - Derivatives in the tree view now provide commands and menu items for visualizing their hierarchies (`View Tree`) and properties (`View Properties`)
  - Support for translating compressed archives
    - When translating an object, if a _root design filename_ is specified, the translation considers the input file
    to be a compressed archive, and the _root design filename_ to be the name of the main file inside the archive

## [0.4.0] - 2019-07-09

- Changed
  - Instead of a single set of Forge credentials, the extension is now configured with a list of environments with different Forge credentials, data regions, etc.
  - The settings can be configured in _User_ or _Workspace_ scope, with _Workspace_ scope having higher precedence

## [0.3.2] - 2019-06-27

- Added
  - Support for creating/updating aliases of DA activities and appbundles
  - Refreshing buckets can now be used to update the list after changing the region settings

## [0.3.1] - 2019-06-26

- Added
  - New configuration property for setting `US` vs `EMEA` regions for buckets
  - Ability to delete OSS objects

## [0.2.0] - 2019-06-24

- Added
  - Support for deleting owned Design Automation resources (app bundles and activities, incl. individual aliases or versions)
  - "View details" of either aliases or versions of owned Design Automation resources
  - "View details" of shared Design Automation app bundles or activities
- Changed
  - Structure of the Design Automation tree view
    - "Owned App Bundles" and "Owned Activities" list just the bundles/activities you own, and each of these items contains lists of its aliases and versions
    - "Shared App Bundles" and "Shared Activities" contain flat lists of fully qualified IDs

## [0.1.1] - 2019-06-24

- Added
  - "View details" of buckets
- Changed
  - Moved to forge-nodejs-utils version 2.0.4 (now using TypeScript)

## [0.1.0] - 2019-06-18

- Added
  - Progress tracking for async operations (downloading/uploading objects, creating buckets, translating files, etc.)
  - Object upload can be cancelled and later resumed (simply start the upload again with the same bucket and object key)
  - Bootstrap UI to detail views (incl. support for VSCode theme colors)
  - Object preview now includes a dropdown with all available 2D/3D viewables
- Changed
  - Details of individual entities (objects, app bundles, activities, ...) are now accessed via "View Details" context menu action
  - Objects now provide a "Preview" context menu action that opens a standalone tab with Forge Viewer

## [0.0.4] - 2019-06-18

- Fixed typo in bucket retention policies

## [0.0.3] - 2019-06-14

- Updated images and videos in README
- Added icon attribution

## [0.0.2] - 2019-06-14

- Minor updates to package.json, README
- Better error handling of async/await calls

## [0.0.1] - 2019-06-14

- Initial release
- Added tree view for browsing Data Management buckets and objects
- Added commands and menus for creating buckets, uploading/downloading objects
- Added webview for previewing objects and their 2D/3D derivatives
- Added tree view for browsing Design Automation appbundles and activities
- Added webview for previewing appbundle or activity details
