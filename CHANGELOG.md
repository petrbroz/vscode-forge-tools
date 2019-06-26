# Changelog

All notable changes to the "vscode-forge-tools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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