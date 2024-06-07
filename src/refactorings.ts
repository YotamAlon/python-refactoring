import { ResolvedEnvironment } from "@vscode/python-extension";
import * as path from "path";
import * as vscode from "vscode";
import { runScriptSync, run_script } from './process';
import { fullRange, groupBy } from "./utils";
import { v4 as uuid } from 'uuid';

interface ScriptOutput {
    path: string;
    new_contents: string;
}

function produceWorkspaceEditFromScriptOutput(command: string, args: Array<string>, document: vscode.TextDocument): vscode.WorkspaceEdit | null {
    let output = runScriptSync(command, args);
    let raw_refactors: Array<ScriptOutput> = JSON.parse(output);
    if (!raw_refactors) {
        return null;
    }
    let editsAndUris = raw_refactors.map(raw_refactor => {
        let uri = vscode.Uri.file(raw_refactor.path);
        if (uri.path !== document.uri.path) {
            throw new Error('Cant do that yet!');
        }
        let range = fullRange(document);
        return { uri: uri, edit: new vscode.TextEdit(range, raw_refactor.new_contents) };
    });

    let textEditsBypath = groupBy(editsAndUris, (item => { return item.uri.path; }));

    let workspaceEdit = new vscode.WorkspaceEdit();

    for (const [path, editsWithUris] of Object.entries(textEditsBypath)) {
        let uri = editsWithUris[0].uri;
        let edits = editsAndUris.map(item => { return item.edit; });
        workspaceEdit.set(uri, edits);
    }
    return workspaceEdit;
}

export function getInlineEdits(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, document: vscode.TextDocument, offset: number): vscode.WorkspaceEdit | null {
    const inlineScript = path.join(scriptsDir, 'inline.py');

    const args = [inlineScript, projectDir, document.fileName, offset.toString()];
    const command = environment.path;
    return produceWorkspaceEditFromScriptOutput(command, args, document);
}

export function getExtractParameterEdits(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, document: vscode.TextDocument, offset: number, new_parameter_name: string | undefined = undefined): vscode.WorkspaceEdit | null {
    const inlineScript = path.join(scriptsDir, 'introduce_parameter.py');
    if (!new_parameter_name) {
        new_parameter_name = 'new_parameter';
    }

    const args = [inlineScript, projectDir, document.fileName, offset.toString(), new_parameter_name];
    const command = environment.path;
    return produceWorkspaceEditFromScriptOutput(command, args, document);
}


export async function executeInline(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor): Promise<vscode.WorkspaceEdit | null> {
    const inlineScript = path.join(scriptsDir, 'inline.py');
    const document = editor.document;
    const offset = document.offsetAt(editor.selection.active);

    let outputs = await run_script(environment.path, [inlineScript, projectDir, document.fileName, offset.toString()]);
    if (!outputs) {
        return null;
    }

    let editsAndUris = await Promise.all(outputs.map(async (output) => {
        let uri = vscode.Uri.file(output.path);
        let doc = await vscode.workspace.openTextDocument(uri);
        let range = fullRange(doc);
        return { uri: uri, edit: new vscode.TextEdit(range, output.new_contents) };
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

export async function executeIntroduceParameter(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor) {
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

export async function executeLocalToField(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, editor: vscode.TextEditor) {
    const localToFieldScript = path.join(scriptsDir, 'local_to_field.py');
    const document = editor.document;
    const offset = document.offsetAt(editor.selection.active);

    let outputs = await run_script(environment.path, [localToFieldScript, projectDir, document.fileName, offset.toString()]);

}
