"use strict";

import * as vscode from 'vscode';
import path from 'path';
import { PythonExtension } from '@vscode/python-extension';
import * as util from 'util';
import {
	Executable,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from "vscode-languageclient/node";

const lspConfigKey = "pylsp";
let client: LanguageClient;

function startPylspServer(
	bundleDir: string,
	python_path: string,
	outputChannel: vscode.LogOutputChannel,
): LanguageClient {
	
	const run_executable: Executable = {
		command: python_path,
		args: ["-m", "pylsp"],
		options: { cwd: bundleDir }
	};
	const debug_executable: Executable = {
		command: python_path,
		args: ["-Xfrozen_modules=off", "-m", "debugpy", "--listen", "5678", "--wait-for-client", "-m", "pylsp", "-vv"],
		options: { cwd: bundleDir }
	};
	const serverOptions: ServerOptions = {run: run_executable, debug: debug_executable};
	const clientOptions: LanguageClientOptions = {
		documentSelector: ["python"],
		synchronize: {
			configurationSection: lspConfigKey,
		},
		outputChannel: outputChannel
	};
	return new LanguageClient(python_path, serverOptions, clientOptions);
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

	const getClient = () => startPylspServer(pythonRootDir, environment.path, outputChannel);

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