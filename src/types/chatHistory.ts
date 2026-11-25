import type { AgentEngineKey, AgentMessage } from "./agent";

export interface ChatSession {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	engine: AgentEngineKey;
	messages: AgentMessage[];
	askVaultEnabled?: boolean;
}

export interface ChatHistoryStore {
	version: number;
	activeSessionId: string | null;
	sessions: ChatSession[];
}
