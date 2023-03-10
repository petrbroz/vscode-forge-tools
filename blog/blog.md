# Generating Access Tokens and Model URNs

Sometimes you may stumble across an interesting code snippet related to the [Viewer SDK](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/overview/) (for example, on [Stack Overflow](https://stackoverflow.com/a/75313369/1759915) or [Codepen.io](https://codepen.io/autodesk-platform-services/pen/OJojMEo)) that requires you to plug in your own access token and model URN. Here's a couple of quick ways to retrieve these:

## Visual Studio Code

If you're developing with [Visual Studio Code](https://code.visualstudio.com/), and you aren't using our [Autodesk Platform Services](https://marketplace.visualstudio.com/items?itemName=petrbroz.vscode-forge-tools) extension yet, I'd suggest that you give it a try. The extension gives you access to APS services and data, incl. the ability to browse OSS buckets and objects, uploading and translating designs using the [Model Derivative service](https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/), etc.

Here's how you can use the extension to quickly generate an access token and a model URN:

- Open Visual Studio Code.
- If you don't have the extension yet, switch to the _Extensions_ section, search for _Autodesk Platform Services_, and install it.
- When you run the extension for the first time, it'll guide you through creating your first "environment"; an environment is basically a configuration for a specific APS application, including client ID and secret, region, etc. You can configure multiple environments and then switch between them.