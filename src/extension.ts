"use strict";

import * as vscode from 'vscode';
import path from 'path';
import { PythonExtension } from '@vscode/python-extension';
import * as util from 'util';
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
	documentSelector: string[],
	outputChannel: vscode.LogOutputChannel,
): LanguageClient {
	const serverOptions: ServerOptions = {
		command: command,
		args: args,
		options: { cwd: bundleDir }
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: documentSelector,
		synchronize: {
			configurationSection: lspConfigKey,
		},
		outputChannel: outputChannel
	};
	return new LanguageClient(command, serverOptions, clientOptions);
}

type Arguments = unknown[];
class OutputChannelLogger {
    constructor(private readonly channel: vscode.LogOutputChannel) {}

    public traceLog(...data: Arguments): void {
        this.channel.appendLine(util.format(...data));
    }

    public traceError(...data: Arguments): void {
        this.channel.error(util.format(...data));
    }

    public traceWarn(...data: Arguments): void {
        this.channel.warn(util.format(...data));
    }

    public traceInfo(...data: Arguments): void {
        this.channel.info(util.format(...data));
    }

    public traceVerbose(...data: Arguments): void {
        this.channel.debug(util.format(...data));
    }
}

let channel: OutputChannelLogger | undefined;
export function registerLogger(outputChannel: vscode.LogOutputChannel): vscode.Disposable {
    channel = new OutputChannelLogger(outputChannel);
    return {
        dispose: () => {
            channel = undefined;
        },
    };
}

export async function activate(context: vscode.ExtensionContext) {
	let outputChannel = vscode.window.createOutputChannel("Python Refactoring", { log: true });
	context.subscriptions.push(outputChannel, registerLogger(outputChannel));
	const pythonRootDir = path.join(__dirname, '..', 'bundled');
	
	const pythonApi: PythonExtension = await PythonExtension.api();
	const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

	const resolvedEnvironment = await pythonApi.environments.resolveEnvironment(environmentPath);
	if (!resolvedEnvironment) {
		vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		return null;
	}
	const environment = resolvedEnvironment;

	const getClient = () => getLanguageClient(pythonRootDir, environment.path, ["-m", "pylsp", "-vv"], ["python"], outputChannel);

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