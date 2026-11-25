import type { App } from "obsidian";
import type AIChatPlugin from "../main";
import type { AgentEngineKey, AgentMessage } from "../types/agent";
import type { ChatHistoryStore, ChatSession } from "../types/chatHistory";

export function deriveTitleFromPrompt(prompt: string): string {
	const cleaned = prompt
		.trim()
		.replace(/^#+\s*/, "") // remove heading markers
		.replace(/[\r\n]+/g, " ") // single line
		.replace(/[^\w\s\-.,?!']/g, "") // remove weird symbols
		.trim();

	if (!cleaned) return "New Chat";
	if (cleaned.length <= 36) return cleaned;

	const truncated = cleaned.substring(0, 35);
	const lastSpace = truncated.lastIndexOf(" ");
	if (lastSpace > 15) {
		return truncated.substring(0, lastSpace).trim() + "…";
	}
	return truncated.trim() + "…";
}

export class ChatHistoryService {
	private plugin: AIChatPlugin;
	private app: App;
	private store: ChatHistoryStore = {
		version: 1,
		activeSessionId: null,
		sessions: [],
	};
	private isLoaded = false;
	private saveTimeout: number | null = null;

	constructor(plugin: AIChatPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	private getStoragePath(): string {
		const configDir = this.app.vault.configDir;
		return `${configDir}/plugins/obsidian-omnichat/chats.json`;
	}

	public async loadStore(): Promise<ChatHistoryStore> {
		if (this.isLoaded) return this.store;

		const path = this.getStoragePath();
		try {
			if (await this.app.vault.adapter.exists(path)) {
				const raw = await this.app.vault.adapter.read(path);
				const data = JSON.parse(raw) as Partial<ChatHistoryStore>;
				if (Array.isArray(data.sessions)) {
					this.store = {
						version: data.version || 1,
						activeSessionId: data.activeSessionId ?? null,
						sessions: data.sessions,
					};
				}
			}
		} catch (err) {
			console.warn("OmniChat: Could not read chats.json, starting fresh", err);
		}

		this.isLoaded = true;
		return this.store;
	}

	public async saveStoreNow(): Promise<void> {
		if (this.saveTimeout !== null) {
			window.clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}

		const path = this.getStoragePath();
		try {
			const json = JSON.stringify(this.store, null, 2);
			await this.app.vault.adapter.write(path, json);
		} catch (err) {
			console.error("OmniChat: Failed to save chat history to", path, err);
		}
	}

	public queueSave(): void {
		if (this.saveTimeout !== null) {
			window.clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = window.setTimeout(() => {
			this.saveTimeout = null;
			void this.saveStoreNow();
		}, 600);
	}

	public getAllSessions(): ChatSession[] {
		return [...this.store.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	public getSession(id: string): ChatSession | undefined {
		return this.store.sessions.find((s) => s.id === id);
	}

	public getActiveSession(): ChatSession | undefined {
		if (this.store.activeSessionId) {
			const found = this.getSession(this.store.activeSessionId);
			if (found) return found;
		}
		return this.getAllSessions()[0];
	}

	public setActiveSession(id: string): ChatSession | undefined {
		const session = this.getSession(id);
		if (session) {
			this.store.activeSessionId = id;
			this.queueSave();
		}
		return session;
	}

	public createSession(engine: AgentEngineKey, title = "New Chat"): ChatSession {
		const now = Date.now();
		const session: ChatSession = {
			id: `chat_${now}_${Math.random().toString(36).substring(2, 7)}`,
			title,
			createdAt: now,
			updatedAt: now,
			engine,
			messages: [],
		};

		this.store.sessions.unshift(session);
		this.store.activeSessionId = session.id;
		this.queueSave();
		return session;
	}

	public updateSessionMessages(
		id: string,
		messages: AgentMessage[],
		engine?: AgentEngineKey,
	): ChatSession | undefined {
		const session = this.getSession(id);
		if (!session) return undefined;

		session.messages = [...messages];
		session.updatedAt = Date.now();
		if (engine) session.engine = engine;

		// Auto-title if currently default and there is at least one user message
		if (session.title === "New Chat") {
			const firstUser = messages.find((m) => m.role === "user");
			if (firstUser?.content) {
				session.title = deriveTitleFromPrompt(firstUser.content);
			}
		}

		this.queueSave();
		return session;
	}

	public renameSession(id: string, newTitle: string): boolean {
		const session = this.getSession(id);
		if (!session) return false;
		session.title = newTitle.trim() || "Untitled Chat";
		session.updatedAt = Date.now();
		this.queueSave();
		return true;
	}

	public deleteSession(id: string): boolean {
		const index = this.store.sessions.findIndex((s) => s.id === id);
		if (index === -1) return false;

		this.store.sessions.splice(index, 1);
		if (this.store.activeSessionId === id) {
			const remaining = this.getAllSessions();
			this.store.activeSessionId = remaining[0]?.id ?? null;
		}

		this.queueSave();
		return true;
	}

	public clearAllSessions(defaultEngine: AgentEngineKey): ChatSession {
		this.store.sessions = [];
		const newSession = this.createSession(defaultEngine, "New Chat");
		this.queueSave();
		return newSession;
	}
}
