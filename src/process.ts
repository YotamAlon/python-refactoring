import util from "node:util";

import { spawn, spawnSync } from 'child_process';
import { PythonExtension, ResolvedEnvironment } from "@vscode/python-extension";
import * as path from "path";
import * as vscode from "vscode";
import { error } from "node:console";


interface ScriptOutput {
	path: string;
	new_contents: string;
}
function runScript(command: string, args: string[], callback: CallableFunction) {
	const inline = spawn(command, args);
	let diffs: Array<ScriptOutput> = [];

	inline.stdout.forEach(diff => {
		diffs.push(JSON.parse(diff));
	});

	inline.stdout.on('end', callback(diffs));

	inline.stderr.on("data", data => {
		console.log(`stderr: ${data}`);
	});

	inline.on('error', error => {
		console.log(`error: ${error.message}`);
	});

	inline.on("close", code => {
		console.log(`child process exited with code ${code}`);
	});
}

export let run_script: (command: string, args: string[]) => Promise<Array<ScriptOutput>> = util.promisify(runScript);interface commandExecutor {
	(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor): Promise<void>;
}
export async function runCommand(func: commandExecutor) {
	const pythonApi: PythonExtension = await PythonExtension.api();

	const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

	const environment = await pythonApi.environments.resolveEnvironment(environmentPath);
	const scriptsDir = path.join(__dirname, '..', 'python');
	if (!environment) {
		vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		return;
	}
	const workspacePaths = vscode.workspace.workspaceFolders?.map(folder => folder.uri.path);
	if (!workspacePaths) {
		vscode.window.showInformationMessage('No project selected');
		return;
	}

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage('No editor is open');
		return;
	}

	const document = editor.document;
	if (!document) {
		vscode.window.showInformationMessage('No file selected');
		return;
	}

	const projectDir = workspacePaths.find(path => document.fileName.includes(path));
	if (!projectDir) {
		vscode.window.showInformationMessage('No project contains the open file');
		return;
	}

	await func(scriptsDir, environment, projectDir, editor);

	vscode.window.showInformationMessage('Done!');
}
export async function getRefactorEdit(func: refactorEdit): Promise<vscode.WorkspaceEdit | null> {
	const pythonApi: PythonExtension = await PythonExtension.api();

	const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

	const environment = await pythonApi.environments.resolveEnvironment(environmentPath);
	const scriptsDir = path.join(__dirname, '..', 'python');
	if (!environment) {
		vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		return null;
	}
	const workspacePaths = vscode.workspace.workspaceFolders?.map(folder => folder.uri.path);
	if (!workspacePaths) {
		vscode.window.showInformationMessage('No project selected');
		return null;
	}

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

	const projectDir = workspacePaths.find(path => document.fileName.includes(path));
	if (!projectDir) {
		vscode.window.showInformationMessage('No project contains the open file');
		return null;
	}

	return await func(scriptsDir, environment, projectDir, editor);

}export interface refactorEdit {
	(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor): Promise<vscode.WorkspaceEdit | null>;
}


export function runScriptSync(command: string, args: string[]): string {
    let process = spawnSync(command, args);
    if (process.error || process.status !== 0) {
        console.log("error: " + process.error);
        console.log("stdout: " + process.stdout.toString());
        console.log("stderr: " + process.stderr.toString());
        return '';
    }
    return process.stdout.toString();
}