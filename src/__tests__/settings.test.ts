import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../settings";
import { CHATGPT_URL, SERVICE_URLS } from "../constants";

describe("DEFAULT_SETTINGS", () => {
	it("sets webAppUrl to the ChatGPT URL", () => {
		expect(DEFAULT_SETTINGS.webAppUrl).toBe(CHATGPT_URL);
	});

	it("default webAppUrl is one of the built-in service URLs", () => {
		expect(Object.values(SERVICE_URLS)).toContain(DEFAULT_SETTINGS.webAppUrl);
	});

	it("enables ChatGPT by default", () => {
		expect(DEFAULT_SETTINGS.enableChatGPT).toBe(true);
	});

	it("enables Claude by default", () => {
		expect(DEFAULT_SETTINGS.enableClaude).toBe(true);
	});

	it("enables DeepSeek by default", () => {
		expect(DEFAULT_SETTINGS.enableDeepSeek).toBe(true);
	});

	it("enables Perplexity by default", () => {
		expect(DEFAULT_SETTINGS.enablePerplexity).toBe(true);
	});

	it("enables Gemini by default", () => {
		expect(DEFAULT_SETTINGS.enableGemini).toBe(true);
	});

	it("enables Grok by default", () => {
		expect(DEFAULT_SETTINGS.enableGrok).toBe(true);
	});

	it("starts with an empty contextItems array", () => {
		expect(DEFAULT_SETTINGS.contextItems).toEqual([]);
	});

	it("has a positive maxContextLength", () => {
		expect(DEFAULT_SETTINGS.maxContextLength).toBeGreaterThan(0);
	});

	it("has a non-negative autoRefreshMinutes", () => {
		expect(DEFAULT_SETTINGS.autoRefreshMinutes).toBeGreaterThanOrEqual(0);
	});

	it("has autoClearContext set to false", () => {
		expect(DEFAULT_SETTINGS.autoClearContext).toBe(false);
	});

	it("has an empty contextPrefix", () => {
		expect(DEFAULT_SETTINGS.contextPrefix).toBe("");
	});

	it("has openOnStartup set to true", () => {
		expect(DEFAULT_SETTINGS.openOnStartup).toBe(true);
	});

	it("contains all required DockSettings keys", () => {
		const requiredKeys: (keyof typeof DEFAULT_SETTINGS)[] = [
			"webAppUrl",
			"openOnStartup",
			"maxContextLength",
			"contextItems",
			"enableChatGPT",
			"enableClaude",
			"enableDeepSeek",
			"enablePerplexity",
			"enableGemini",
			"enableGrok",
			"enableCopilot",
			"enableManus",
			"enableKimi",
			"autoRefreshMinutes",
			"autoClearContext",
			"contextPrefix",
			"theme",
			"sendSelectionEnabled",
			"promptTemplates",
			"autoContextOnOpen",
			"stripFrontmatter",
			"saveNoteFolder",
			"useDateSubfolder",
			"customServices",
			"splitPanelUrl",
		];
		for (const key of requiredKeys) {
			expect(Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)).toBe(true);
		}
	});
});
