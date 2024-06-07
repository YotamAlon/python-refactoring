import * as vscode from "vscode";


export function fullRange(document: vscode.TextDocument): vscode.Range {
	const lastLine = document.lineCount - 1;
	const lastCharacter = document.lineAt(lastLine).text.length;
	return new vscode.Range(0, 0, lastLine, lastCharacter);
}


export const groupBy = <T, K extends keyof any>(list: T[], getKey: (item: T) => K) => list.reduce((previous, currentItem) => {
	const group = getKey(currentItem);

	if (!previous[group]) {
		previous[group] = [];
	};

	previous[group].push(currentItem);
	return previous;

},
	{} as Record<K, T[]>
);
