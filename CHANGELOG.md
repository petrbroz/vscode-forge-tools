# Changelog

All notable changes to the "vscode-forge-tools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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