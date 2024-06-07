// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PythonExtension } from '@vscode/python-extension';
import { exec } from "child_process";
import util from 'node:util';
import { text } from 'stream/consumers';
import { executeInline, executeIntroduceParameter, executeLocalToField, getExtractParameterEdits, getInlineEdits } from './refactorings';
import { runCommand, getRefactorEdit } from './process';
import path from 'path';
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
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "python-refactoring" is now active!');
	await setUp();

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

	class RefactorCodeActionProvider implements vscode.CodeActionProvider {
		static readonly actionKinds = [vscode.CodeActionKind.RefactorInline, vscode.CodeActionKind.RefactorExtract];
		private getInlineAction(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction | null {
			let action = new vscode.CodeAction('Inline', vscode.CodeActionKind.RefactorInline);
			if (!environment) {
				vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
				return null;
			}
			if (!projectDir) {
				vscode.window.showInformationMessage('No project contains the open file');
				return null;
			}
			let offset = document.offsetAt(range.start);
			let edit = getInlineEdits(scriptsDir, environment, projectDir, document, offset);
			if (!edit) {
				return null;
			}
			action.edit = edit;
			return action;
		}
		private getExtractParameterAction(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction | null {
			let action = new vscode.CodeAction('Extract Parameter', vscode.CodeActionKind.RefactorExtract);
			if (!environment) {
				vscode.window.showInformationMessage('No environment configured, cannot execute refactoring!');
				return null;
			}
			if (!projectDir) {
				vscode.window.showInformationMessage('No project contains the open file');
				return null;
			}
			let offset = document.offsetAt(range.start);
			let edit = getExtractParameterEdits(scriptsDir, environment, projectDir, document, offset);
			if (!edit) {
				return null;
			}
			action.edit = edit;
			return action;
		}
		provideCodeActions(
			document: vscode.TextDocument,
			range: vscode.Range | vscode.Selection,
			context: vscode.CodeActionContext,
			token: vscode.CancellationToken
		): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
			if (context.triggerKind === vscode.CodeActionTriggerKind.Automatic) {
				return [];
			}
			if (context.only?.value !== 'refactor') {
				return [];
			}
			let actions: Array<vscode.CodeAction> = [];
			let inline = this.getInlineAction(document, range);
			if (inline) {actions.push(inline);}
			let extractParameter = this.getExtractParameterAction(document, range);
			if (extractParameter) {actions.push(extractParameter);}
			return actions;
		}
	}
	vscode.languages.registerCodeActionsProvider(
		{ scheme: 'file', language: 'python' },
		new RefactorCodeActionProvider(),
		{ providedCodeActionKinds: RefactorCodeActionProvider.actionKinds }
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
