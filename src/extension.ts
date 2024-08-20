"use strict";

import * as vscode from 'vscode';
import path from 'path';
import { PythonExtension } from '@vscode/python-extension';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

const lspConfigKey = "pylsp";
let client: LanguageClient;

function getLanguageClient(
    bundleDir: string,
  command: string,
  args: string[],
  documentSelector: string[]
): LanguageClient {
  const serverOptions: ServerOptions = {
    command: command,
    args: args,
    options: {cwd: bundleDir}
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: documentSelector,
    synchronize: {
      configurationSection: lspConfigKey,
    },
  };
  return new LanguageClient(command, serverOptions, clientOptions);
}

export async function activate(context: vscode.ExtensionContext) {
	const pythonRootDir = path.join(__dirname, '..', 'bundled');
	const pythonApi: PythonExtension = await PythonExtension.api();
	const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

	const resolvedEnvironment = await pythonApi.environments.resolveEnvironment(environmentPath);
	if (!resolvedEnvironment) {
		vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		return null;
	}
	const environment = resolvedEnvironment;

	let projectDir: string;
	const workspacePaths = vscode.workspace.workspaceFolders?.map(folder => folder.uri.path);
	if (!workspacePaths || workspacePaths?.length === 0) {
		vscode.window.showInformationMessage('No project selected');
		return null;
	} else if (workspacePaths.length > 1) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('No editor is open');
			return null;
		}

		const document = editor.document;
		if (!document) {
			vscode.window.showInformationMessage('No file selected');
			return null;
		}

		const chosenProjectDir = workspacePaths.find(path => document.fileName.includes(path));
		if (!chosenProjectDir) {
			vscode.window.showInformationMessage('No project contains the open file');
			return null;
		}
		projectDir = chosenProjectDir;
	} else {
		projectDir = workspacePaths[0];
	}
  const getClient = () => getLanguageClient(pythonRootDir, environment.path, ["-m", "pylsp", "-vv"], ["python"]);

  client = getClient();
  context.subscriptions.push(client.start());

  context.subscriptions.push(
    vscode.commands.registerCommand(`${lspConfigKey}.restartServer`, async () => {
      await killServer();
      client = getClient();
      client.start();
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  return killServer();
}

async function killServer(): Promise<void> {
  await client.stop();
}