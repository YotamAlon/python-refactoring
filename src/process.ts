import util from "node:util";

import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { ResolvedEnvironment } from "@vscode/python-extension";
import path from "path";
import EventEmitter from "events";


export let asyncRunScript: (command: string, args: string[]) => Promise<string> = util.promisify(runScriptAsync);

export function runScriptAsync(command: string, args: string[], callback: CallableFunction): void {
	let process = spawn(command, args);
	let output = '';
	process.stdout.on('data', data => {
		output += data.toString();
	});
	process.on('error', error => {
		console.log(`error: ${error.message}`);
		callback(error.message, '');
	});
	process.on('close', (status) => {
		if (status !== 0) {
			console.log("status: " + status?.toString());
			console.log("stdout: " + process.stdout.toString());
			console.log("stderr: " + process.stderr.toString());
			callback(null, '');
		}
		callback(null, output);
	});
}

enum RefactorType {
	Inline = 'inline',
	ExtractParameter = 'introduce_parameter',
}

export interface ChangedFile {
	path: string
	new_contents: string
}

interface Refactor {
	type: RefactorType,
	changed_files: Array<ChangedFile>
}

interface Message {
	message: string
}

export class RopeClient {
	private process: ChildProcessWithoutNullStreams;
	private emitter: EventEmitter;

	constructor(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string, config: vscode.WorkspaceConfiguration) {
		let command = environment.path;
		let configuration = {ignored_resources: config.get('ignored_resources'), source_folders: config.get('source_folders')};
		let args = [path.join(scriptsDir, 'rope_server.py'), projectDir, JSON.stringify(configuration)];
		this.process = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
		this.emitter = new EventEmitter();

        // Listen for data from subprocess stdout
        this.process.stdout.on('data', (data: Buffer) => {
            const message = data.toString().trim();
			console.log(message);
            try {
                const json = JSON.parse(message);
                this.emitter.emit('message', json);
            } catch (error) {
                this.emitter.emit('error', new Error(`Failed to parse JSON: ${message}`));
            }
        });

        // Listen for errors from subprocess stderr
        this.process.stderr.on('data', (data: Buffer) => {
			console.log(data.toString());
            this.emitter.emit('error', new Error(data.toString().trim()));
        });

        // Listen for subprocess exit event
        this.process.on('exit', (code) => {
			console.log('Process exited with code '+ code?.toString());
            this.emitter.emit('exit', code);
        });
    }

    private async communicate(message: object): Promise<any> {
        return new Promise((resolve, reject) => {
            const jsonString = JSON.stringify(message);

            // Function to handle the message event
            const onMessage = (response: any) => {
                this.emitter.off('error', onError);
                resolve(response);
            };

            // Function to handle the error event
            const onError = (error: Error) => {
                this.emitter.off('message', onMessage);
                reject(error);
            };

            // Attach one-time listeners
            this.emitter.once('message', onMessage);
            this.emitter.once('error', onError);

            // Send the JSON message to the subprocess
            this.process.stdin.write(jsonString + '\n', (error) => {
                if (error) {
                    this.emitter.off('message', onMessage);
                    this.emitter.off('error', onError);
                    reject(error);
                }
            });
        });
    }

	async start(): Promise<void> {
		let response = await this.communicate({});
		let message = response as Message;
		if (message.message !== 'ready') {
			throw Error('Rope process is not ready!');
		}
	}

	async getRefactors(fileName: string, offset: number): Promise<Array<Refactor>> {
		let response = await this.communicate([fileName, offset]);
		if (!response) {
			return [];
		}
		let raw_refactors: Array<Refactor> = response as Array<Refactor>;
		return raw_refactors;
	}
}
