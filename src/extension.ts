// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PythonExtension } from '@vscode/python-extension';
import { exec } from "child_process";
import util from 'node:util';
import { ChangedFile, RopeClient } from './process';
import path from 'path';
import { fullRange, groupBy } from './utils';
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

	const scriptsDir = path.join(__dirname, '..', 'python');
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

	const client = new RopeClient(scriptsDir, environment, projectDir);
	try {
		await client.start();
	} catch (error) {
		console.log(error);
	}

	class RefactorCodeActionProvider implements vscode.CodeActionProvider {
		static readonly actionKinds = [vscode.CodeActionKind.RefactorInline, vscode.CodeActionKind.RefactorExtract];

		provideCodeActions(
			document: vscode.TextDocument,
			range: vscode.Range | vscode.Selection,
			context: vscode.CodeActionContext,
			token: vscode.CancellationToken
		): vscode.ProviderResult<Array<vscode.CodeAction>> {
			if (context.triggerKind === vscode.CodeActionTriggerKind.Automatic) {
				return [];
			}
			if (context.only?.value !== 'refactor') {
				return [];
			}
			let provider = this;
			async function getActions(): Promise<Array<vscode.CodeAction>> {
				function notNull<TValue>(value: TValue | null): value is TValue {
					return value !== null;
				}
				let offset = document.offsetAt(range.start);
				let raw_actions = await client.getRefactors(document.fileName, offset);
				let actions = await Promise.all(raw_actions.map(async raw_action => {
					let action: vscode.CodeAction;
					if (raw_action.type === 'inline') {
						action = new vscode.CodeAction('Inline', vscode.CodeActionKind.RefactorInline);
					} else if (raw_action.type === 'introduce_parameter') {
						action = new vscode.CodeAction('Extract Parameter', vscode.CodeActionKind.RefactorExtract);
					} else {
						throw new Error(`Unknown refactor type ${raw_action.type}`);
					}
					let workspaceEdit = await provider.editFromChangedFiles(raw_action.changed_files);
					action.edit = workspaceEdit;
					return action;
				}));
				let validActions = actions.filter(notNull);

				return validActions;
			}
			return getActions();
		}

		private async editFromChangedFiles(changed_files: Array<ChangedFile>) {
			let editsAndUris = await Promise.all(changed_files.map(async (changed_file) => {
				let uri = vscode.Uri.file(changed_file.path);
				let document = await vscode.workspace.openTextDocument(uri);
				let range = fullRange(document);
				return { uri: uri, edit: new vscode.TextEdit(range, changed_file.new_contents) };
			}));
			let textEditsBypath = groupBy(editsAndUris, (item => { return item.uri.path; }));

			let workspaceEdit = new vscode.WorkspaceEdit();

			for (const [path, editsWithUris] of Object.entries(textEditsBypath)) {
				let uri = editsWithUris[0].uri;
				let edits = editsAndUris.map(item => { return item.edit; });
				workspaceEdit.set(uri, edits);
			}
			return workspaceEdit;
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
