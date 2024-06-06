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

	let diffs = await run_script(environment.path, [inlineScript, projectDir, document.fileName, offset.toString()]);
}

async function executeIntroduceParameter(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor) {
	const introduceParameterScript = path.join(scriptsDir, 'introduce_parameter.py');
	const document = editor.document;
	const offset = document.offsetAt(editor.selection.active);

	// const input = await vscode.window.showInputBox().then(parameter_name => {
	// 	if (!parameter_name) {
	// 		return;
	// 	}
	// 	let diffs = await run_script(environment.path, [introduceParameterScript, projectDir, document.fileName, offset.toString(), parameter_name]);
	// });
}

async function executeLocalToField(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor) {
	const localToFieldScript = path.join(scriptsDir, 'local_to_field.py');
	const document = editor.document;
	const offset = document.offsetAt(editor.selection.active);

	let diffs = await run_script(environment.path, [localToFieldScript, projectDir, document.fileName, offset.toString()]);
}

function runScript(command: string, args: string[], callback: CallableFunction) {
	const inline = spawn(command, args);
	let diffs: Array<string> = [];

	inline.stdout.forEach(diff => {
		diffs.push(diff);
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

let run_script = util.promisify(runScript);

async function applyDiffs(diffs: Array<string>): Promise<void> {
	let edit = new vscode.WorkspaceEdit();

}

interface commandExecutor {
	(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor): Promise<void>
}

async function runCommand(func: commandExecutor) {
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
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "python-refactoring" is now active!');
	await setUp();

	let inline = vscode.commands.registerCommand('python-refactoring.inline', async () => {
		runCommand(executeInline);
	});

	let introduceParameter = vscode.commands.registerCommand('python-refactoring.introduce_parameter', async () => {
		runCommand(executeIntroduceParameter);
	});
	let localToField = vscode.commands.registerCommand('python-refactoring.local_to_field', async () => {
		runCommand(executeLocalToField);
	});
	context.subscriptions.push(inline);
	context.subscriptions.push(introduceParameter);
	context.subscriptions.push(localToField);
	class InlineCodeAction implements vscode.CodeActionProvider {
		static readonly kind = vscode.CodeActionKind.RefactorInline
		static readonly inlineCodeAction = new vscode.CodeAction('Inline', InlineCodeAction.kind);
		provideCodeActions(): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
			let action = structuredClone(InlineCodeAction.inlineCodeAction);
			action.command = {command: "python-refactoring.inline", title: 'Inline', arguments: []};
			return [action];
		}
	}
	vscode.languages.registerCodeActionsProvider(
		{ scheme: 'file', language: 'python' },
		new InlineCodeAction(),
		{ providedCodeActionKinds: [InlineCodeAction.kind] }
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
