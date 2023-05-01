# VSC Local Sessions

Allows you to access VS Code Live Sessions from your other devices by storing session data in a Pocketbase DB.

# Preconfiguration

 1. Setup a pocketbase instance (or use an existing one)
 2. Create a new collection called `vscode_live_share_sessions`
 3. The collection should have the following fields:
    - `machineId` (string)
    - `sessionUrl` (string)
    - `projectName` (string)
    - `deviceName` (string)
 4. Open VSCode settings and set the 'Pocketbase URL' (`vscls.pocketbaseUrl`) to your Pocketbase instance URL
 5. If your collection is set to 'admin only', you should set the 'Pocketbase Auth Email' (`vscls.pocketbaseEmail`) and 'Pocketbase Auth Password' (`vscls.pocketbasePassword`) settings to your Pocketbase email and password

## How to use it

**IMPORTANT:** Creating a new share session will end any current share sessions that are active within this instance of VSCode.

Open editor, start your live session by pressing `Ctrl+Shift+p` and selecting `VSCLS: Create session`. You will be prompted to provide a name for the device and a name for the project.
This will first create a session with the VSCode Live Share service, then store the session data in your Pocketbase DB.

Once the session is started, you can access it from any other device by pressing `Ctrl+Shift+p` and selecting `VSCLS: Join session`. You will be prompted to select a session from the list of available sessions. You will only be able to see sessions that are not for your existing device.

## Commands

* `VSCLS: Create session` - Creates a new VSCode Live Share session and stores the session data in your Pocketbase DB
* `VSCLS: List sessions` - Retrieves all sessions from your Pocketbase DB

## Development

Make changes to the `src/extension.ts` file and run `yarn tsc -p ./ && yarn vscode:prepublish` (or `yarn build`) to compile the changes. If you have installed the extension from the same folder as the source code, you should then `Ctrl+Shift+p` and select `Developer: Reload Window` to reload the extension.