# VSC Local Sessions (Pocketbase)

Allows you to access VS Code Live Sessions from your other devices by storing session data in a Pocketbase DB.

## Note from the author

As of version 1.5.0 of this extension, it is no longer possible to use public/authless instances of Pocketbase.
This is because we've now switched to storing them in secure storage within VSCode rather than via extension settings.
This change is incompatible with the way that extensions present their settings page.

You should run `VSCLS: Configure Server` to set your Pocketbase login email and password instead.

If you need to use this extension with a public/authless instance, consider using version 1.4.2 of the extension.

# Preconfiguration

 1. Setup a pocketbase instance (or use an existing one)
 2. Create a new collection called `vscode_live_share_sessions`
 3. The collection should have the following fields:
    - `machineId` (string)
    - `sessionUrl` (string)
    - `projectName` (string)
    - `deviceName` (string)
 4. Open VSCode settings and set the 'Pocketbase URL' (`vscls.pocketbaseUrl`) to your Pocketbase instance URL
 5. **[New in v1.5.0]** Run `VSCLS: Configure Server` to set the email you use to login to your Pocketbase instance. Public/Authless instances aren't supported as of v1.5.0 - consider using v1.4.2 of the extension if you need this feature.
 6. You can also set your device name in the 'This device name' (`vscls.thisDeviceName`) setting. If you don't set this, you will be prompted to provide a name each time you create a session

## How to use it

**IMPORTANT:** Creating a new share session will end any current share sessions that are active within this instance of VSCode.

Open editor, start your live session by pressing `Ctrl+Shift+p` and selecting `VSCLS: Create session`. You will be prompted to provide a name for the device and a name for the project.
This will first create a session with the VSCode Live Share service, then store the session data in your Pocketbase DB.

Once the session is started, you can access it from any other device by pressing `Ctrl+Shift+p` and selecting `VSCLS: Join session`. You will be prompted to select a session from the list of available sessions. You will only be able to see sessions that are not for your existing device.

## Commands

* `VSCLS: Create session` - Creates a new VSCode Live Share session and stores the session data in your Pocketbase DB
* `VSCLS: List sessions` - Retrieves all sessions from your Pocketbase DB
* `VSCLS: Delete session` - Lists all available sessions - selecting one will delete it from your Pocketbase DB (**note: it doesn't end the live share session currently**)
* [v1.5.0+] `VSCLS: Configure server` - Configure your pocketbase login email and password
* [v1.5.0+] `VSCLS: Clear stored login credentials` - Clears the stored login credentials

## Development

Make changes to the `src/extension.ts` file and run `yarn tsc -p ./ && yarn vscode:prepublish` (or `yarn build`) to compile the changes. If you have installed the extension from the same folder as the source code, you should then `Ctrl+Shift+p` and select `Developer: Reload Window` to reload the extension.