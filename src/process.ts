import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { ResolvedEnvironment } from "@vscode/python-extension";
import path from "path";
import EventEmitter from "events";
import { Serializable } from "node:child_process";
import { off } from 'process';


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

interface RopeConfiguration {
	ignored_resources: Array<string> | undefined
	source_folders: Array<string> | undefined
}

export class RopeClient {
	private process: ChildProcessWithoutNullStreams | undefined;
	private emitter: EventEmitter;
	private scriptsDir: string;
	private environment: ResolvedEnvironment;
	private projectDir: string;
	private configuration: RopeConfiguration = {ignored_resources: undefined, source_folders: undefined};

	constructor(scriptsDir: string, environment: ResolvedEnvironment, projectDir: string) {
		this.scriptsDir = scriptsDir;
		this.environment = environment;
		this.projectDir = projectDir;
		this.emitter = new EventEmitter();
    }
	
	public async start(): Promise<void> {
		this.process = this.start_process();
		let response = await this.communicate({});

		let message = response as Message;
		if (message.message !== 'ready') {
			throw Error('Rope process is not ready!');
		}
	}

	public async stop(): Promise<void> {
		this.process?.kill();
	}

	public async restart(): Promise<void> {
		await this.stop();
		await this.start();
	}

	public async getRefactors(fileName: string, offset: number): Promise<Array<Refactor>> {
		console.log(`Getting refactors for ${fileName}:${offset}`);
		let response = await this.communicate([fileName, offset]);
		if (!response) {
			console.log('got empty response');
			return [];
		}
		let raw_refactors: Array<Refactor> = response as Array<Refactor>;
		console.log(`Got ${raw_refactors.length} refactors`);
		return raw_refactors;
	}

	public setConfiguration(config: RopeConfiguration): void {
		this.configuration = config;
	}
	
	private start_process(): ChildProcessWithoutNullStreams {
		let command = this.environment.path;
		const serverPath = path.join(this.scriptsDir, 'rope_server.py');
		let args = [serverPath, this.projectDir, JSON.stringify(this.configuration)];
		console.log(`starting rope process using ${command} ${args}`);
		let process = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

		// Listen for data from subprocess stdout
		process.stdout.on('data', (data: Buffer) => {
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
		process.stderr.on('data', (data: Buffer) => {
			console.log(`Rope Server: ${data.toString()}`);
			// this.emitter.emit('error', new Error(data.toString().trim()));
		});

		process.on('error', (error: Error) => {
			console.log(`Rope Server error: ${error.toString()}`);
		});

		// Listen for subprocess exit event
		process.on('exit', (code) => {
			console.log('Process exited with code ' + code?.toString());
			this.emitter.emit('exit', code);
		});

		return process;
	}

    private async communicate(message: Serializable): Promise<any> {
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
            this.process?.stdin.write(jsonString + '\n', (error) => {
                if (error) {
					console.log(`Could not send message ${jsonString} to process - ${error}`);
                    this.emitter.off('message', onMessage);
                    this.emitter.off('error', onError);
                    reject(error);
                }
            });
        });
    }
}
