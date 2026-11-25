import type { App } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import type { AgentEngineKey, CliDetectionResult } from "../types/agent";
import type { DockSettings } from "../settings";

interface NodeChildProcessModule {
	spawn: (
		command: string,
		args: string[],
		options: {
			cwd?: string;
			env?: Record<string, string | undefined>;
			shell?: boolean | string;
			stdio?: (string | number)[];
		},
	) => NodeChildProcess;
}

interface NodeChildProcess {
	stdout?: {
		on: (event: string, listener: (chunk: Buffer | string) => void) => void;
	};
	stderr?: {
		on: (event: string, listener: (chunk: Buffer | string) => void) => void;
	};
	stdin?: {
		write: (data: string) => void;
		end: () => void;
	};
	on: (event: string, listener: (arg: unknown) => void) => void;
	kill: (signal?: string) => boolean;
	pid?: number;
}

interface NodeFsModule {
	existsSync: (path: string) => boolean;
	statSync: (path: string) => { isFile: () => boolean };
}

interface NodePathModule {
	join: (...paths: string[]) => string;
	delimiter: string;
}

interface NodeOsModule {
	homedir: () => string;
	platform: () => string;
}

function getNodeRequire<T>(moduleName: string): T | null {
	try {
		if (typeof window !== "undefined") {
			const win = window as unknown as { require?: (id: string) => unknown };
			if (typeof win.require === "function") {
				return win.require(moduleName) as T;
			}
		}
		if (typeof process !== "undefined") {
			const proc = process as unknown as { getBuiltinModule?: (id: string) => unknown };
			if (typeof proc.getBuiltinModule === "function") {
				const mod = proc.getBuiltinModule(moduleName);
				if (mod) return mod as T;
			}
		}
		// Fallback for node test runners without process.getBuiltinModule
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const dynamicRequire = new Function("m", "try { return require(m); } catch { return null; }") as (id: string) => unknown;
		const res = dynamicRequire(moduleName);
		if (res) return res as T;
	} catch {
		// Module not accessible
	}
	return null;
}

/** Check if running inside desktop Electron with Node available. */
export function isDesktopNodeAvailable(): boolean {
	return getNodeRequire<NodeChildProcessModule>("child_process") !== null;
}

/** Strip ANSI control and color codes from terminal output. */
export function stripAnsiCodes(input: string): string {
	// eslint-disable-next-line no-control-regex
	return input.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

/** Build an augmented PATH environment string including standard user bin directories. */
export function getAugmentedPath(): string {
	const os = getNodeRequire<NodeOsModule>("os");
	const path = getNodeRequire<NodePathModule>("path");
	const home = os?.homedir() || process.env.HOME || "";
	const currentPath = process.env.PATH || "";
	const isWindows = (os?.platform() ?? process.platform) === "win32";
	const delimiter = isWindows ? ";" : ":";

	const candidateDirs: string[] = [];
	if (home) {
		if (path) {
			candidateDirs.push(path.join(home, ".local", "bin"));
			candidateDirs.push(path.join(home, ".cargo", "bin"));
			candidateDirs.push(path.join(home, "bin"));
			candidateDirs.push(path.join(home, ".npm-global", "bin"));
		} else {
			candidateDirs.push(`${home}/.local/bin`);
			candidateDirs.push(`${home}/.cargo/bin`);
			candidateDirs.push(`${home}/bin`);
		}
	}

	if (!isWindows) {
		candidateDirs.push(
			"/opt/homebrew/bin",
			"/opt/homebrew/sbin",
			"/usr/local/bin",
			"/usr/local/sbin",
			"/usr/bin",
			"/bin",
			"/usr/sbin",
			"/sbin",
		);
	}

	const seen = new Set<string>();
	const parts: string[] = [];

	for (const p of currentPath.split(delimiter)) {
		if (p.trim() && !seen.has(p)) {
			seen.add(p);
			parts.push(p);
		}
	}

	for (const dir of candidateDirs) {
		if (dir && !seen.has(dir)) {
			seen.add(dir);
			parts.push(dir);
		}
	}

	return parts.join(delimiter);
}

/** Locate an executable binary on disk or in PATH. */
export function findExecutable(binName: string, customPath?: string): string | null {
	const fs = getNodeRequire<NodeFsModule>("fs");
	const path = getNodeRequire<NodePathModule>("path");
	if (!fs || !path) return null;

	if (customPath?.trim()) {
		const target = customPath.trim();
		try {
			if (fs.existsSync(target) && fs.statSync(target).isFile()) {
				return target;
			}
		} catch {
			// Ignore access errors
		}
	}

	// If binName has path separators, check directly
	if (binName.includes("/") || binName.includes("\\")) {
		try {
			if (fs.existsSync(binName) && fs.statSync(binName).isFile()) {
				return binName;
			}
		} catch {
			return null;
		}
		return null;
	}

	const isWindows = process.platform === "win32";
	const extensions = isWindows ? [".exe", ".cmd", ".bat", ""] : [""];
	const searchPath = getAugmentedPath();
	const delimiter = isWindows ? ";" : ":";
	const dirs = searchPath.split(delimiter);

	for (const dir of dirs) {
		if (!dir.trim()) continue;
		for (const ext of extensions) {
			const candidate = path.join(dir, binName + ext);
			try {
				if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
					return candidate;
				}
			} catch {
				// Continue search
			}
		}
	}

	return null;
}

/** Detect CLI executable and test version. */
export async function detectCli(binName: string, customPath?: string): Promise<CliDetectionResult> {
	if (!isDesktopNodeAvailable()) {
		return { found: false, path: "", error: "CLI requires Obsidian desktop (Node.js environment)" };
	}

	const resolved = findExecutable(binName, customPath);
	if (!resolved) {
		return {
			found: false,
			path: customPath || binName,
			error: `Executable "${binName}" not found in PATH or standard directories.`,
		};
	}

	const cp = getNodeRequire<NodeChildProcessModule>("child_process");
	if (!cp) {
		return { found: false, path: resolved, error: "child_process module unavailable" };
	}

	return new Promise<CliDetectionResult>((resolve) => {
		try {
			const env = { ...process.env, PATH: getAugmentedPath() };
			const isWindows = process.platform === "win32";
			const proc = cp.spawn(resolved, ["--version"], {
				stdio: ["ignore", "pipe", "pipe"],
				env,
				shell: isWindows,
			});

			let stdout = "";
			let stderr = "";

			proc.stdout?.on("data", (chunk: Buffer | string) => {
				stdout += chunk.toString();
			});

			proc.stderr?.on("data", (chunk: Buffer | string) => {
				stderr += chunk.toString();
			});

			const timeout = window.setTimeout(() => {
				try {
					proc.kill();
				} catch {
					// Ignore
				}
				resolve({
					found: true,
					path: resolved,
					version: stdout.trim() || undefined,
					error: "Version check timed out",
				});
			}, 4000);

			proc.on("close", (code: unknown) => {
				window.clearTimeout(timeout);
				if (code === 0 || stdout.trim()) {
					resolve({
						found: true,
						path: resolved,
						version: stripAnsiCodes(stdout.trim()),
					});
				} else {
					resolve({
						found: true,
						path: resolved,
						error: stripAnsiCodes(stderr.trim()) || `Exited with code ${String(code)}`,
					});
				}
			});

			proc.on("error", (err: unknown) => {
				window.clearTimeout(timeout);
				resolve({
					found: false,
					path: resolved,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		} catch (e) {
			resolve({
				found: false,
				path: resolved,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	});
}

/** Get the working directory for CLI execution based on settings and vault. */
export function getCliWorkingDirectory(app: App, settings: DockSettings): string {
	if (settings.useVaultAsCliCwd && app.vault.adapter instanceof FileSystemAdapter) {
		return app.vault.adapter.getBasePath();
	}
	if (settings.cliWorkingDirectory?.trim()) {
		return settings.cliWorkingDirectory.trim();
	}
	if (app.vault.adapter instanceof FileSystemAdapter) {
		return app.vault.adapter.getBasePath();
	}
	return "";
}

export interface CliToolEvent {
	id: string;
	name: string;
	input?: string;
	output?: string;
	status: "running" | "done" | "error";
}

export interface CliExecutionOptions {
	app: App;
	settings: DockSettings;
	engine: AgentEngineKey;
	prompt: string;
	onChunk: (text: string) => void;
	onThoughtChunk?: (text: string) => void;
	onToolEvent?: (event: CliToolEvent) => void;
	onStderr?: (text: string) => void;
	onDone: (fullText: string) => void;
	onError: (err: string) => void;
}

export interface CliExecutionHandle {
	kill: () => void;
	write: (data: string) => void;
}

export interface ParsedCliStreamResult {
	textDeltas: string[];
	thoughtDeltas: string[];
	toolEvents: CliToolEvent[];
	finalResult?: string;
}

/**
 * Parse a single NDJSON line emitted by `claude --output-format stream-json --verbose`.
 * Falls back gracefully to plain text if the line is not JSON.
 */
export function parseClaudeStreamJsonLine(line: string): ParsedCliStreamResult {
	const result: ParsedCliStreamResult = {
		textDeltas: [],
		thoughtDeltas: [],
		toolEvents: [],
	};
	const trimmed = line.trim();
	if (!trimmed) return result;
	if (!trimmed.startsWith("{")) {
		result.textDeltas.push(line);
		return result;
	}

	try {
		const obj = JSON.parse(trimmed) as Record<string, unknown>;
		const type = obj.type;

		if (type === "assistant" && obj.message && typeof obj.message === "object") {
			const msg = obj.message as { content?: unknown[] };
			if (Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (!block || typeof block !== "object") continue;
					const b = block as Record<string, unknown>;
					if (b.type === "text" && typeof b.text === "string" && b.text) {
						result.textDeltas.push(b.text);
					} else if (b.type === "thinking" && typeof b.thinking === "string" && b.thinking) {
						result.thoughtDeltas.push(b.thinking);
					} else if (b.type === "tool_use" && typeof b.name === "string") {
						const inputStr = b.input !== undefined ? JSON.stringify(b.input, null, 2) : undefined;
						result.toolEvents.push({
							id: typeof b.id === "string" ? b.id : `${b.name}-${Date.now()}`,
							name: b.name,
							input: inputStr,
							status: "running",
						});
					}
				}
			}
		} else if (type === "user" && obj.message && typeof obj.message === "object") {
			const msg = obj.message as { content?: unknown[] };
			if (Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (!block || typeof block !== "object") continue;
					const b = block as Record<string, unknown>;
					if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
						let out = "";
						if (typeof b.content === "string") {
							out = b.content;
						} else if (Array.isArray(b.content)) {
							out = b.content
								.map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
								.filter(Boolean)
								.join("\n");
						}
						result.toolEvents.push({
							id: b.tool_use_id,
							name: "tool",
							output: out.slice(0, 1200),
							status: b.is_error === true ? "error" : "done",
						});
					}
				}
			}
		} else if (type === "content_block_delta" && obj.delta && typeof obj.delta === "object") {
			const delta = obj.delta as Record<string, unknown>;
			if (delta.type === "text_delta" && typeof delta.text === "string") {
				result.textDeltas.push(delta.text);
			} else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
				result.thoughtDeltas.push(delta.thinking);
			}
		} else if (type === "result" && typeof obj.result === "string" && obj.result) {
			result.finalResult = obj.result;
		}
	} catch {
		result.textDeltas.push(line);
	}

	return result;
}

/**
 * Construct CLI process arguments for a given engine and user prompt.
 * Ensures flags like `--output-format` appear before `-p`, and `-p` is immediately followed by the prompt.
 */
export function buildCliArgs(
	engine: AgentEngineKey,
	prompt: string,
	options: {
		dangerouslySkipPermissions?: boolean;
		cliCustomArgs?: string;
		outputFormat?: "text" | "stream-json";
	} = {},
): string[] {
	const args: string[] = [];

	if (engine === "claude-cli" || engine === "antigravity-cli") {
		const fmt = options.outputFormat ?? "text";
		args.push("--output-format", fmt);
		if (fmt === "stream-json") {
			args.push("--verbose");
		}
		if (options.dangerouslySkipPermissions) {
			args.push("--dangerously-skip-permissions");
		}
		if (options.cliCustomArgs?.trim()) {
			const extra = options.cliCustomArgs.trim().split(/\s+/);
			args.push(...extra);
		}
		// Pass prompt attached to -p so -p does not consume other flags
		args.push("-p", prompt);
	} else {
		if (options.cliCustomArgs?.trim()) {
			const extra = options.cliCustomArgs.trim().split(/\s+/);
			args.push(...extra);
		}
		args.push(prompt);
	}

	return args;
}

/** Execute an agent CLI command with streaming output. */
export function executeCliPrompt(options: CliExecutionOptions): CliExecutionHandle {
	const { app, settings, engine, prompt, onChunk, onThoughtChunk, onToolEvent, onStderr, onDone, onError } = options;

	if (!isDesktopNodeAvailable()) {
		onError("CLI engines are only supported on Obsidian desktop.");
		return { kill: () => {}, write: () => {} };
	}

	const cp = getNodeRequire<NodeChildProcessModule>("child_process");
	if (!cp) {
		onError("Failed to load Node child_process module.");
		return { kill: () => {}, write: () => {} };
	}

	let binName = "claude";
	let customPath = "";
	let leadingCustomArgs: string[] = [];

	if (engine === "claude-cli") {
		binName = "claude";
		customPath = settings.claudeCliPath;
	} else if (engine === "antigravity-cli") {
		binName = "agy";
		customPath = settings.antigravityCliPath;
	} else if (engine === "codex-cli") {
		binName = "codex";
		customPath = settings.codexCliPath;
	} else if (engine === "custom-cli") {
		const parts = settings.customCliCommand.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) {
			onError("Custom CLI command is empty. Please configure it in OmniChat settings under Agent CLI & API.");
			return { kill: () => {}, write: () => {} };
		}
		binName = parts[0] ?? "";
		leadingCustomArgs = parts.slice(1);
		customPath = "";
	}

	const resolvedBin = findExecutable(binName, customPath);
	if (!resolvedBin) {
		onError(
			`Could not find executable for "${binName}". Please install it or set its full path in OmniChat Agent Settings.`,
		);
		return { kill: () => {}, write: () => {} };
	}

	const useStreamJson =
		engine === "claude-cli" && !settings.cliCustomArgs?.includes("--output-format");
	const args = [
		...leadingCustomArgs,
		...buildCliArgs(engine, prompt, {
			...settings,
			outputFormat: useStreamJson ? "stream-json" : "text",
		}),
	];

	const cwd = getCliWorkingDirectory(app, settings);
	const isWindows = process.platform === "win32";

	// Environment variable injection
	const env: Record<string, string | undefined> = {
		...process.env,
		PATH: getAugmentedPath(),
	};

	if (settings.cliEnvironmentVariables?.trim()) {
		for (const line of settings.cliEnvironmentVariables.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const idx = trimmed.indexOf("=");
			if (idx > 0) {
				const k = trimmed.substring(0, idx).trim();
				const v = trimmed.substring(idx + 1).trim();
				env[k] = v;
			}
		}
	}

	let accumulated = "";
	let stderrAccumulated = "";
	let stdoutBuffer = "";

	const handleStreamJsonLine = (line: string) => {
		const parsed = parseClaudeStreamJsonLine(line);
		for (const thought of parsed.thoughtDeltas) {
			onThoughtChunk?.(thought);
		}
		for (const tool of parsed.toolEvents) {
			onToolEvent?.(tool);
		}
		for (const txt of parsed.textDeltas) {
			accumulated += txt;
			onChunk(txt);
		}
		if (parsed.finalResult && accumulated.length === 0) {
			accumulated = parsed.finalResult;
			onChunk(parsed.finalResult);
		}
	};

	try {
		const proc = cp.spawn(resolvedBin, args, {
			cwd: cwd || undefined,
			env,
			shell: isWindows,
			stdio: ["pipe", "pipe", "pipe"],
		});

		proc.stdout?.on("data", (chunk: Buffer | string) => {
			const clean = stripAnsiCodes(chunk.toString());
			if (useStreamJson) {
				stdoutBuffer += clean;
				const lines = stdoutBuffer.split("\n");
				stdoutBuffer = lines.pop() ?? "";
				for (const line of lines) {
					handleStreamJsonLine(line);
				}
			} else {
				accumulated += clean;
				onChunk(clean);
			}
		});

		proc.stderr?.on("data", (chunk: Buffer | string) => {
			const clean = stripAnsiCodes(chunk.toString());
			stderrAccumulated += clean;
			if (clean.trim()) onStderr?.(clean);
		});

		proc.on("close", (code: unknown) => {
			if (useStreamJson && stdoutBuffer.trim()) {
				handleStreamJsonLine(stdoutBuffer);
				stdoutBuffer = "";
			}
			if (code === 0 || accumulated.length > 0) {
				onDone(accumulated);
			} else {
				onError(stderrAccumulated.trim() || `Process exited with error code ${String(code)}`);
			}
		});

		proc.on("error", (err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			onError(`Failed to execute "${binName}": ${msg}`);
		});

		// Close stdin so non-interactive CLI does not wait
		try {
			proc.stdin?.end();
		} catch {
			// Ignore
		}

		return {
			kill: () => {
				try {
					proc.kill("SIGINT");
				} catch {
					try {
						proc.kill();
					} catch {
						// Process already dead
					}
				}
			},
			write: (data: string) => {
				try {
					proc.stdin?.write(data);
				} catch {
					// Ignore
				}
			},
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		onError(`Failed to launch process: ${msg}`);
		return { kill: () => {}, write: () => {} };
	}
}
