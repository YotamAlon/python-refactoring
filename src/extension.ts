// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PythonExtension } from '@vscode/python-extension';
import { spawn } from "child_process";
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "python-refactoring" is now active!');
	// Import the API

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
		const folderName = path.basename(__dirname);
		console.log(`Folder name is "${folderName}"`);
		const scripts_dir = path.join(__dirname, '..', 'python');
		const inline_script = path.join(scripts_dir, 'inline.py')
		vscode.window.showInformationMessage(`${folderName}, ${scripts_dir}`);
		if (environment) {
			const inline = spawn(environment.path, [inline_script]);

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
			vscode.window.showInformationMessage('Done!');
		} else {
			vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
