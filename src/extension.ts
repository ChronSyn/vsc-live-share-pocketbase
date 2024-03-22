// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as vsls from "vsls/vscode";
import * as vslsBase from "vsls";
import "cross-fetch/polyfill";

const PocketBase = require("pocketbase/cjs");

const sessionsCollectionName = 'vscode_live_share_sessions';
var extensionGlobalContext: vscode.ExtensionContext;

const debugLog = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - [VSC Live Share (Pocketbase)]: ${message}`);
}

interface ILoadSecretFromStorageArgs {
  context: vscode.ExtensionContext
  secretName: string
}

const loadSecretFromStorage = async ({ context, secretName }: ILoadSecretFromStorageArgs) => {
  if (!secretName) {
    return null;
  }

  if (!context?.secrets) {
    return null;
  }

  try {
    const secret = await context.secrets.get(secretName);
    return secret;
  } catch (err) {
    return null;
  }
}

interface IStoreSecretInStorageArgs extends ILoadSecretFromStorageArgs {
  secretValue: string
}

const storeSecretInStorage = async ({ context, secretName, secretValue }: IStoreSecretInStorageArgs) => {
  if (!secretName) {
    return null;
  }

  if (!secretValue) {
    return null;
  }

  if (!context?.secrets) {
    return null;
  }
  try {
    await context.secrets.store(secretName, secretValue);
    debugLog(`Stored secret in the VSCode secret storage: ${secretName}`);
  } catch (err) {
    debugLog(`There was an error storing the secret in the VSCode secret storage: ${err}`);
    return null;
  }
  return true;
}

const removeSecretFromStorage = async ({ context, secretName }: ILoadSecretFromStorageArgs) => {
  if (!secretName) {
    return null;
  }

  if (!context?.secrets) {
    return null;
  }

  try {
    await context.secrets.delete(secretName);
    debugLog(`Removed secret from the VSCode secret storage: ${secretName}`);
  } catch (err) {
    debugLog(`There was an error removing the secret from the VSCode secret storage: ${err}`);
    return null;
  }
  return true;
}

const promptForProjectName = async () => {
  const projectName = await vscode.window.showInputBox({
    prompt: "Enter a name for this project",
    placeHolder: vscode.workspace.name ?? '',
    value: vscode.workspace.name ?? ''
  });
  return projectName;
}

const removeLegacyInsecureSettings = async () => {
  const legacySettings = [
    'vscls.pocketbaseAuthEmail',
    'vscls.pocketbaseAuthPassword'
  ];
  for (const setting of legacySettings) {
    await vscode.workspace.getConfiguration('vscls').update(setting, undefined, true);
  }
}

const clearSecrets = async (context: vscode.ExtensionContext) => {
  await removeSecretFromStorage({
    context,
    secretName: 'vscls.pocketbaseAuthEmail'
  });
  await removeSecretFromStorage({
    context,
    secretName: 'vscls.pocketbaseAuthPassword'
  });
}

const promptForDeviceName = async () => {
  let thisDeviceName = vscode.workspace.getConfiguration('vscls').get('thisDeviceName') as string;
  if (!thisDeviceName || (thisDeviceName ?? '')?.length === 0) {
    // Get the device name from VSCode
    const deviceName = await vscode.window.showInputBox({
      prompt: "Enter a name for this device",
      placeHolder: vscode.env.machineId ?? '',
      value: vscode.env.machineId ?? '',
    });
    thisDeviceName = deviceName ?? vscode.env.machineId ?? '';
  }
  return thisDeviceName;
}

const promptForPocketbaseLoginEmail = async (context: vscode.ExtensionContext) => {
  let authEmail = await loadSecretFromStorage({
    context: context,
    secretName: 'vscls.pocketbaseAuthEmail'
  });
  if (!authEmail) {
    authEmail = await vscode.window.showInputBox({
      prompt: "Enter the email address you use to login to Pocketbase (must have admin access)",
      placeHolder: ""
    });
    if (!authEmail) {
      return null;
    }
    await storeSecretInStorage({
      context: context,
      secretName: 'vscls.pocketbaseAuthEmail',
      secretValue: authEmail
    });
  }
}

const promptForPocketbaseLoginPassword = async (context: vscode.ExtensionContext) => {
  let authPassword = await loadSecretFromStorage({
    context: context,
    secretName: 'vscls.pocketbaseAuthPassword'
  });
  if (!authPassword) {
    authPassword = await vscode.window.showInputBox({
      prompt: "Enter the password you use to login to Pocketbase (must have admin access)",
      placeHolder: "",
      password: true
    });
    if (!authPassword) {
      return null;
    }
    await storeSecretInStorage({
      context: context,
      secretName: 'vscls.pocketbaseAuthPassword',
      secretValue: authPassword
    });
  }
}

const promptForCredentials = async (context: vscode.ExtensionContext) => {
  await removeLegacyInsecureSettings();
  const authEmail = await loadSecretFromStorage({
    context: context,
    secretName: 'vscls.pocketbaseAuthEmail'
  });
  const authPassword = await loadSecretFromStorage({
    context: context,
    secretName: 'vscls.pocketbaseAuthPassword'
  });
  if (!authEmail || !authPassword) {
    await promptForPocketbaseLoginEmail(context);
    const checkAuthEmailExists = await loadSecretFromStorage({
      context: context,
      secretName: 'vscls.pocketbaseAuthEmail'
    });
    if (!checkAuthEmailExists) {
      vscode.window.showInformationMessage(`You need to configure pocketbase auth details first. Please run "VSCLS: Configure Server" from the command palette.`);
      debugLog(`You need to configure pocketbase auth details first. Please run "VSCLS: Configure Server" from the command palette.`);
      return null;
    }

    await promptForPocketbaseLoginPassword(context);
    const checkAuthPasswordExists = await loadSecretFromStorage({
      context: context,
      secretName: 'vscls.pocketbaseAuthPassword'
    });
    if (!checkAuthPasswordExists) {
      vscode.window.showInformationMessage(`You need to configure pocketbase auth details first. Please run "VSCLS: Configure Server" from the command palette.`);
      console.log(`You need to configure pocketbase auth details first. Please run "VSCLS: Configure Server" from the command palette.`);
      return null;
    }
  }
  return true;
}

const pocketbaseInstance = new PocketBase(vscode.workspace.getConfiguration('vscls').get('pocketbaseUrl'));

const authToPocketbase = async () => {
  const credentialsExist = await promptForCredentials(extensionGlobalContext);
  if (!credentialsExist) {
    return null;
  }
  try {
    debugLog(`Loading auth email and password from storage`)
    const authEmail = await loadSecretFromStorage({
      context: extensionGlobalContext,
      secretName: 'vscls.pocketbaseAuthEmail'
    });
    const authPassword = await loadSecretFromStorage({
      context: extensionGlobalContext,
      secretName: 'vscls.pocketbaseAuthPassword'
    });

    const authRes = await pocketbaseInstance.admins.authWithPassword(authEmail, authPassword);
    if (!authRes?.token) {
      debugLog(`No token found in auth response`)
      return null;
    }
    return pocketbaseInstance;
  } catch (err) {
    debugLog(`There was an error authenticating to Pocketbase: ${err}`)
    return null;
  }
}



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


const deleteSession = async (id: string) => {
  try {
    const session = await authToPocketbase();
    if (!session) {
      return null
    }
    const deleteRes = await pocketbaseInstance
      .collection(sessionsCollectionName)
      .delete(id);
    return deleteRes;
  } catch (err) {
    vscode.window.showErrorMessage(`There was an error deleting the session: ${err}`);
  }
}

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
  debugLog(`Create Session - trying to auth to PB`)
  try {
    const session = await authToPocketbase();
    if (!session) {
      debugLog(`Session is null in createSession`)
      return null
    } else {
      debugLog(`Session is not null in createSession`)
    }
    debugLog(`Creating session with args: ${JSON.stringify(args)}`)
    const record = await pocketbaseInstance.collection(sessionsCollectionName).create(args);
    debugLog(`Created session: ${JSON.stringify(record)}`)
    return record;
  } catch (err) {
    debugLog(`There was an error creating the session: ${err}`)
    return null;
  }
};

const upsertSession = async (args: ICreateSessionArgs) => {
  const session = await authToPocketbase();
  if (!session) {
    debugLog(`Session is null in upsertSession`)
    return null
  }

  if (!args?.deviceName || (args.deviceName ?? '')?.length === 0) {
    const newSession = await createSession(args)
    return newSession;
  }

  const filter = `machineId = '${args?.machineId}' && projectName = '${args?.projectName}' && deviceName = '${args?.deviceName}'`;

  const currentProjects = await pocketbaseInstance.collection(sessionsCollectionName).getFullList({
    filter,
  })

  if ((currentProjects ?? []).length <= 0) {
    const newSession = await createSession(args)
    return newSession;
  }

  if (!currentProjects?.[0]) {
    const newSession = await createSession(args)
    return newSession;
  }

  // If there is already a session for this device, create a new live share session and update the existing DB entry
  const currentProject = currentProjects[0];
  const newSession = await pocketbaseInstance.collection(sessionsCollectionName).update(currentProject.id, args);
  return newSession;
};

export function activate(context: vscode.ExtensionContext) {
  extensionGlobalContext = context;
  // CONFIGURE SERVER
  const configureServerCommand = vscode.commands.registerCommand(
    "extension.configureServer",
    async () => {
      await promptForPocketbaseLoginEmail(context);
      await promptForPocketbaseLoginPassword(context);
    }
  );

  const clearCredentialsCommand = vscode.commands.registerCommand(
    "extension.clearCredentials",
    async () => {
      await clearSecrets(context);
    }
  );

  // CREATE SESSION
  const createSessionCommand = vscode.commands.registerCommand(
    "extension.createSession",
    async () => {
      try {
        const session = await authToPocketbase();
        if (!session) {
          debugLog(`Session is null in createSessionCommand`)
          return null
        }

        debugLog(`Session is not null in createSessionCommand - it is:`)
        debugLog(JSON.stringify(session))
        
        const liveshare = await getVslsApi();
        debugLog(`Liveshare is:`)
        debugLog(JSON.stringify(liveshare))
        if (liveshare === null) {
          debugLog(`Liveshare is null in createSessionCommand`)
          return;
        }

        debugLog(`Liveshare is not null in createSessionCommand - it is ${liveshare}`)

        const thisDeviceName = await promptForDeviceName()
        const projectName = await promptForProjectName();

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

        const shouldUpdateExistingSession = (vscode.workspace.getConfiguration('vscls').get('overwriteExistingProject') ?? true) as boolean;
        if (shouldUpdateExistingSession) {
          const createdSession = await upsertSession({
            machineId,
            sessionUrl: finalSessionUrl.toString(),
            deviceName: thisDeviceName ?? vscode.env.machineId ?? '',
            projectName: projectName ?? vscode.workspace.name ?? '',
          });
          return createdSession;
        }

        const createdSession = await createSession({
          machineId,
          sessionUrl: finalSessionUrl.toString(),
          deviceName: thisDeviceName ?? vscode.env.machineId ?? '',
          projectName: projectName ?? vscode.workspace.name ?? '',
        });
        return createdSession;
      } catch (err) {
        debugLog(`There was an error creating the session in createSessionCommand: ${err}`)
      }
  });

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
            description: `[${session?.updated ?? session?.created ?? ''}] ${session.deviceName} ${session.machineId ? `(${session.machineId})` : ''}`,
            detail: `[${session?.updated ?? session?.created ?? ''}] ${session.deviceName} ${session.machineId ? `(${session.machineId})` : ''}`,
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


  // DELETE SESSION
  const deleteSessionCommand = vscode.commands.registerCommand(
    "extension.deleteSession",
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
        // .filter(
        //   // Remove any sessions that are from this machine as we can't join sessions on the same machine (due to a session already being active)
        //   (item: ICreateSessionArgs) => item.machineId !== machineId
        // )
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
      await deleteSession(selectedSession.meta.id);
    }
  );

  context.subscriptions.push(createSessionCommand);
  context.subscriptions.push(listSessionsCommand);
  context.subscriptions.push(deleteSessionCommand);
  context.subscriptions.push(configureServerCommand);
  context.subscriptions.push(clearCredentialsCommand);

  if (!context.subscriptions.find((s) => s === createSessionCommand)) {
  }

  if (!context.subscriptions.find((s) => s === listSessionsCommand)) {
  }

  if (!context.subscriptions.find((s) => s === deleteSessionCommand)) {
  }
  if (!context.subscriptions.find((s) => s === configureServerCommand)) {
  }
  if (!context.subscriptions.find((s) => s === clearCredentialsCommand)) {
  }
}

export function deactivate() {}

async function getVslsApi(): Promise<vsls.LiveShare | null> {
      const liveshare = await vsls.getApi();
      debugLog(`Got the Live Share API: ${liveshare}`);
      return liveshare;
}