export type UIMode = "browser" | "agent";

export type AgentEngineKey =
	| "claude-cli"
	| "antigravity-cli"
	| "codex-cli"
	| "anthropic-api"
	| "openai-api"
	| "ollama"
	| "custom-cli";

export interface AgentEngineMeta {
	readonly key: AgentEngineKey;
	readonly label: string;
	readonly desc: string;
	readonly type: "cli" | "api";
	readonly icon: string;
	readonly defaultCommand?: string;
	readonly badge: string;
}

export const AGENT_ENGINES: readonly AgentEngineMeta[] = [
	{
		key: "claude-cli",
		label: "Claude Code CLI",
		desc: "Autonomous coding agent CLI by Anthropic",
		type: "cli",
		icon: "terminal",
		defaultCommand: "claude",
		badge: "CLI Agent",
	},
	{
		key: "antigravity-cli",
		label: "Antigravity CLI",
		desc: "Google Deepmind agentic CLI coding assistant",
		type: "cli",
		icon: "sparkles",
		defaultCommand: "agy",
		badge: "CLI Agent",
	},
	{
		key: "codex-cli",
		label: "OpenAI Codex CLI",
		desc: "Agentic coding and terminal assistant",
		type: "cli",
		icon: "code",
		defaultCommand: "codex",
		badge: "CLI Agent",
	},
	{
		key: "anthropic-api",
		label: "Anthropic Claude API",
		desc: "Direct API streaming with Claude 3.7 / 3.5 Sonnet",
		type: "api",
		icon: "cpu",
		badge: "Direct API",
	},
	{
		key: "openai-api",
		label: "OpenAI / Codex API",
		desc: "Direct API streaming with GPT-4o, o3-mini or compatible endpoint",
		type: "api",
		icon: "zap",
		badge: "Direct API",
	},
	{
		key: "ollama",
		label: "Ollama Local API",
		desc: "Privacy-focused local LLMs running on your machine",
		type: "api",
		icon: "hard-drive",
		badge: "Local API",
	},
	{
		key: "custom-cli",
		label: "Custom Agent CLI",
		desc: "Run your own custom CLI tool, agent or script",
		type: "cli",
		icon: "play",
		defaultCommand: "",
		badge: "Custom CLI",
	},
] as const;

export interface AgentMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	thoughts?: string;
	tools?: {
		name: string;
		input?: string;
		output?: string;
		status: "running" | "done" | "error";
	}[];
	timestamp: number;
	engine: AgentEngineKey;
	contextFiles?: string[];
}

export interface CliDetectionResult {
	found: boolean;
	path: string;
	version?: string;
	error?: string;
}
