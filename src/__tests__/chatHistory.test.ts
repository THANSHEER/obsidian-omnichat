import { describe, it, expect } from "vitest";
import { deriveTitleFromPrompt, ChatHistoryService } from "../services/ChatHistoryService";
import { extractSearchKeywords, VaultQueryService, type VaultNoteContext } from "../services/VaultQueryService";
import type AIChatPlugin from "../main";

if (typeof (globalThis as any).window === "undefined") {
	(globalThis as any).window = globalThis;
}

describe("deriveTitleFromPrompt", () => {
	it("derives clean titles from regular prompts", () => {
		expect(deriveTitleFromPrompt("How to set up React in Obsidian")).toBe(
			"How to set up React in Obsidian",
		);
	});

	it("strips markdown headings and extra whitespace", () => {
		expect(deriveTitleFromPrompt("### What is the Second Brain concept?\n\nDetails...")).toBe(
			"What is the Second Brain concept?…",
		);
	});

	it("truncates long prompts to 36 chars with ellipsis", () => {
		const longPrompt = "Explain the detailed implementation of neural network backpropagation algorithms";
		const title = deriveTitleFromPrompt(longPrompt);
		expect(title.length).toBeLessThanOrEqual(37);
		expect(title.endsWith("…")).toBe(true);
	});

	it("falls back to 'New Chat' on empty or symbol-only prompt", () => {
		expect(deriveTitleFromPrompt("")).toBe("New Chat");
		expect(deriveTitleFromPrompt("   \n\t  ")).toBe("New Chat");
	});
});

describe("ChatHistoryService", () => {
	function createMockPlugin(): AIChatPlugin {
		const store = new Map<string, string>();
		const mockPlugin = {
			app: {
				vault: {
					configDir: ".obsidian",
					adapter: {
						exists: async (p: string) => store.has(p),
						read: async (p: string) => store.get(p) ?? "",
						write: async (p: string, data: string) => {
							store.set(p, data);
						},
					},
				},
			},
		} as unknown as AIChatPlugin;
		return mockPlugin;
	}

	it("creates a new session with unique ID and sets it as active", () => {
		const plugin = createMockPlugin();
		const service = new ChatHistoryService(plugin);

		const session = service.createSession("claude-cli", "New Chat");
		expect(session.id).toBeDefined();
		expect(session.title).toBe("New Chat");
		expect(session.engine).toBe("claude-cli");
		expect(service.getActiveSession()?.id).toBe(session.id);
	});

	it("renames a session properly", () => {
		const plugin = createMockPlugin();
		const service = new ChatHistoryService(plugin);

		const session = service.createSession("antigravity-cli", "Initial Title");
		const success = service.renameSession(session.id, "Renamed Research Topic");
		expect(success).toBe(true);

		const retrieved = service.getSession(session.id);
		expect(retrieved?.title).toBe("Renamed Research Topic");
	});

	it("auto-titles a session from the first user message if title is 'New Chat'", () => {
		const plugin = createMockPlugin();
		const service = new ChatHistoryService(plugin);

		const session = service.createSession("ollama", "New Chat");
		service.updateSessionMessages(session.id, [
			{
				id: "1",
				role: "user",
				content: "Summarize the machine learning notes in my vault",
				timestamp: Date.now(),
				engine: "ollama",
			},
		]);

		const updated = service.getSession(session.id);
		expect(updated?.title).toBe("Summarize the machine learning…");
	});

	it("deletes a session and updates active session if deleted one was active", () => {
		const plugin = createMockPlugin();
		const service = new ChatHistoryService(plugin);

		const s1 = service.createSession("claude-cli", "Session 1");
		const s2 = service.createSession("claude-cli", "Session 2");

		expect(service.getActiveSession()?.id).toBe(s2.id);

		const deleted = service.deleteSession(s2.id);
		expect(deleted).toBe(true);
		expect(service.getSession(s2.id)).toBeUndefined();
		expect(service.getActiveSession()?.id).toBe(s1.id);
	});

	it("clears all sessions and starts a fresh one", () => {
		const plugin = createMockPlugin();
		const service = new ChatHistoryService(plugin);

		service.createSession("claude-cli", "Chat 1");
		service.createSession("claude-cli", "Chat 2");

		expect(service.getAllSessions().length).toBe(2);

		const fresh = service.clearAllSessions("claude-cli");
		expect(fresh.title).toBe("New Chat");
		expect(service.getAllSessions().length).toBe(1);
	});
});

describe("VaultQueryService", () => {
	it("extractSearchKeywords filters out common stop words", () => {
		const kw = extractSearchKeywords("What notes in my vault talk about quantum physics and chemistry?");
		expect(kw).toContain("quantum");
		expect(kw).toContain("physics");
		expect(kw).toContain("chemistry");
		expect(kw).not.toContain("what");
		expect(kw).not.toContain("vault");
		expect(kw).not.toContain("my");
		expect(kw).not.toContain("in");
	});

	it("formatVaultPrompt includes note references and user question", () => {
		const mockNotes: VaultNoteContext[] = [
			{
				file: {} as any,
				score: 100,
				snippet: "Quantum entanglement is a physical phenomenon...",
				title: "Quantum Mechanics",
				path: "Physics/Quantum Mechanics.md",
			},
		];

		const formatted = VaultQueryService.formatVaultPrompt(mockNotes, "Explain entanglement");
		expect(formatted).toContain("Vault Knowledge Base: 1 note retrieved");
		expect(formatted).toContain("[[Quantum Mechanics]]");
		expect(formatted).toContain("Quantum entanglement is a physical phenomenon...");
		expect(formatted).toContain("Explain entanglement");
	});
});
