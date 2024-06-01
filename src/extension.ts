// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PythonExtension, ResolvedEnvironment } from '@vscode/python-extension';
import { spawn, exec } from "child_process";
import * as path from 'path';
import util from 'node:util';
const aexec = util.promisify(exec);

async function setUp() {
	const pythonApi: PythonExtension = await PythonExtension.api();

	// This will return something like /usr/bin/python
	const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

	// `environmentPath.path` carries the value of the setting. Note that this path may point to a folder and not the
	// python binary. Depends entirely on how the env was created.
	// E.g., `conda create -n myenv python` ensures the env has a python binary
	// `conda create -n myenv` does not include a python binary.
	// Also, the path specified may not be valid, use the following to get complete details for this environment if
	// need be.

	const environment = await pythonApi.environments.resolveEnvironment(environmentPath);
	if (!environment) {
		vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		return;
	}
	if (environment.environment?.type !== 'VirtualEnvironment') {
		vscode.window.showInformationMessage(
			'python refactorings currently require the use of a virtual evironment'
		);
		return;
	}
	await aexec(`${environment.path} -m pip install rope`);
}

async function executeInline(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor) {
	const inlineScript = path.join(scriptsDir, 'inline.py');
	const document = editor.document;
	const offset = document.offsetAt(editor.selection.active);

	const inline = spawn(environment.path, [inlineScript, projectDir, document.fileName, offset.toString()]);

	inline.stdout.on("data", data => {
		console.log(`stdout: ${data}`);
	});

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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "python-refactoring" is now active!');
	await setUp();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('python-refactoring.inline', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// Load the Python extension API
		const pythonApi: PythonExtension = await PythonExtension.api();

		// This will return something like /usr/bin/python
		const environmentPath = pythonApi.environments.getActiveEnvironmentPath();

		// `environmentPath.path` carries the value of the setting. Note that this path may point to a folder and not the
		// python binary. Depends entirely on how the env was created.
		// E.g., `conda create -n myenv python` ensures the env has a python binary
		// `conda create -n myenv` does not include a python binary.
		// Also, the path specified may not be valid, use the following to get complete details for this environment if
		// need be.

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

		await executeInline(scriptsDir, environment, projectDir, editor);

		vscode.window.showInformationMessage('Done!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
