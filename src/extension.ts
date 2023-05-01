// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as vsls from "vsls/vscode";
import "cross-fetch/polyfill";

const PocketBase = require("pocketbase/cjs");

// import pb from "pocketbase";
// const _pb = new pb('')

// const login = async () => {
//   const authRes = await _pb.admins.authWithPassword('', '')
//   if (!authRes?.token) {
//     vscode.window.showErrorMessage(`There was an error authenticating to your pocketbase instance. Please ensure that you have configured your Pocketbase email and password in the VSCode settings (vscls.pocketbaseAuthEmail / vscls.pocketbaseAuthPassword)`);
//     return pocketbaseInstance;
//   }
// }

const pocketbaseInstance = new PocketBase(vscode.workspace.getConfiguration('vscls').get('pocketbaseUrl'));

const authToPocketbase = async () => {
  try {
    const authEmail = vscode.workspace.getConfiguration('vscls').get('pocketbaseAuthEmail');
    const authPassword = vscode.workspace.getConfiguration('vscls').get('pocketbaseAuthPassword');

    if (!authEmail || !authPassword) {
      return pocketbaseInstance;
    }

    const authRes = await pocketbaseInstance.admins.authWithPassword(authEmail, authPassword);
    if (!authRes?.token) {
      vscode.window.showErrorMessage(`There was an error authenticating to your pocketbase instance. Please ensure that you have configured your Pocketbase email and password in the VSCode settings (vscls.pocketbaseAuthEmail / vscls.pocketbaseAuthPassword)`);
      return null;
    }
    return pocketbaseInstance;
  } catch (err) {
    vscode.window.showErrorMessage(`There was an error authenticating to your pocketbase instance. Please ensure that you have configured your Pocketbase email and password in the VSCode settings (vscls.pocketbaseAuthEmail / vscls.pocketbaseAuthPassword)`);
    return null;
  }

  // return pocketbaseInstance;
}

const sessionsCollectionName = 'vscode_live_share_sessions';

const listSessions = async () => {
  try {
    const session = await authToPocketbase();
    if (!session) {
      return null
    }
    const resultList = await pocketbaseInstance
      .collection(sessionsCollectionName)
      .getList(1, 1000);
    return resultList;
  } catch (err) {
    vscode.window.showErrorMessage(`There was an error listing sessions: ${err} - Please ensure that you have configured your Pocketbase URL in the VSCode settings (vscls.pocketbaseUrl)`);
  }
};

interface ICreateSessionArgs {
  machineId: string;
  sessionUrl: string;
  deviceName: string;
  projectName: string;
}

interface ISelectSessionDropdown {
  label: string;
  description: string;
  detail: string;
  meta: {
    collectionId: string;
    collectionName: string;
    created: string;
    deviceName: string;
    id: string;
    machineId: string;
    projectName: string;
    sessionUrl: string;
    updated: string;
    expand: {};
  };
}

const createSession = async (args: ICreateSessionArgs) => {
  const session = await authToPocketbase();
  if (!session) {
    return null
  }
  const record = await pocketbaseInstance.collection(sessionsCollectionName).create(args);
  return record;
};

export function activate(context: vscode.ExtensionContext) {
  // CREATE SESSION
  const createSessionCommand = vscode.commands.registerCommand(
    "extension.createSession",
    async () => {
      const session = await authToPocketbase();
      if (!session) {
        return null
      }
      
      const liveshare = await getVslsApi();
      if (liveshare === null) {
        return;
      }

      // Get the device name from VSCode
      const deviceName = await vscode.window.showInputBox({
        prompt: "Enter a name for this device",
        placeHolder: vscode.env.machineId ?? '',
        value: vscode.env.machineId ?? '',
      });

      // Get the project/workspace name from VSCode
      const projectName = await vscode.window.showInputBox({
        prompt: "Enter a name for this project",
        placeHolder: vscode.workspace.name ?? '',
        value: vscode.workspace.name ?? ''
      });

      const { machineId } = vscode.env;
      await liveshare.end();
      const sessionUrl = await liveshare.share().catch((err) => {
        vscode.window.showErrorMessage(`There was an error sharing your session: ${err}. This is an error with the 'VSCode Live Share' extension and not with the 'VSC Live Share (Pocketbase)' extension.`);
      })
      const clipboardUrl = await vscode.env.clipboard.readText();
      const finalSessionUrl = (sessionUrl ?? clipboardUrl).toString();
      if (!finalSessionUrl) {
        return;
      }

      const createdSession = await createSession({
        machineId,
        sessionUrl: finalSessionUrl.toString(),
        deviceName: deviceName ?? vscode.env.machineId ?? '',
        projectName: projectName ?? vscode.workspace.name ?? '',
      });
      return createdSession;
    }
  );

  // LIST SESSIONS
  const listSessionsCommand = vscode.commands.registerCommand(
    "extension.listSessions",
    async () => {
      const session = await authToPocketbase();
      if (!session) {
        return null
      }

      const sessions = await listSessions();
      if (!sessions) {
        return;
      }

      // Add the sessions to the command palette / quick pick
      // When user selects a session, join the session
      const { machineId } = vscode.env;
      const sessionQuickPickItems = sessions
        .items
        .filter(
          // Remove any sessions that are from this machine as we can't join sessions on the same machine (due to a session already being active)
          (item: ICreateSessionArgs) => item.machineId !== machineId
        )
        .map((session: any) => {
          return {
            label: `${session.projectName} ${session.sessionUrl ? `(${session.sessionUrl})` : ''}`,
            description: `${session.deviceName} ${session.machineId ? `(${session.machineId})` : ''}`,
            detail: `${session.deviceName} ${session.machineId ? `(${session.machineId})` : ''}`,
            meta: session,
          };
        });

      const selectedSession = await vscode.window.showQuickPick(
        sessionQuickPickItems,
        {
          canPickMany: false,
        },
      );


      if (!selectedSession) {
        return;
      }

      const liveshare = await getVslsApi();
      if (!liveshare) {
        return;
      }
      await liveshare.end();
      //@ts-ignore
      if (!selectedSession.meta.sessionUrl) {
        return;
      }
      // convert item.meta.sessionUrl to vscode.Uri
      //@ts-ignore
      const sessionUrl = vscode.Uri.parse(selectedSession.meta.sessionUrl);
      liveshare.join(sessionUrl);
    }
  );

  context.subscriptions.push(createSessionCommand);
  context.subscriptions.push(listSessionsCommand);

  if (!context.subscriptions.find((s) => s === createSessionCommand)) {
  }

  if (!context.subscriptions.find((s) => s === listSessionsCommand)) {
  }
}

export function deactivate() {}

async function getVslsApi(): Promise<vsls.LiveShare | null> {
  const liveshare = await vsls.getApi();
  return liveshare;
}