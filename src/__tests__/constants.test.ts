import { describe, it, expect } from "vitest";
import {
	CHATGPT_URL,
	CLAUDE_URL,
	DEEPSEEK_URL,
	PERPLEXITY_URL,
	GEMINI_URL,
	GROK_URL,
	SERVICE_URLS,
} from "../constants";

describe("SERVICE_URLS", () => {
	it("has exactly six service entries", () => {
		expect(Object.keys(SERVICE_URLS)).toHaveLength(6);
	});

	it("contains all expected service keys", () => {
		expect(Object.keys(SERVICE_URLS)).toEqual(
			expect.arrayContaining(["chatgpt", "claude", "deepseek", "perplexity", "gemini", "grok"]),
		);
	});

	it("every URL starts with https://", () => {
		for (const url of Object.values(SERVICE_URLS)) {
			expect(url).toMatch(/^https:\/\//);
		}
	});

	it("chatgpt entry matches CHATGPT_URL", () => {
		expect(SERVICE_URLS.chatgpt).toBe(CHATGPT_URL);
	});

	it("claude entry matches CLAUDE_URL", () => {
		expect(SERVICE_URLS.claude).toBe(CLAUDE_URL);
	});

	it("deepseek entry matches DEEPSEEK_URL", () => {
		expect(SERVICE_URLS.deepseek).toBe(DEEPSEEK_URL);
	});

	it("perplexity entry matches PERPLEXITY_URL", () => {
		expect(SERVICE_URLS.perplexity).toBe(PERPLEXITY_URL);
	});

	it("gemini entry matches GEMINI_URL", () => {
		expect(SERVICE_URLS.gemini).toBe(GEMINI_URL);
	});

	it("grok entry matches GROK_URL", () => {
		expect(SERVICE_URLS.grok).toBe(GROK_URL);
	});
});

describe("individual URL constants", () => {
	const urlMap = {
		CHATGPT_URL,
		CLAUDE_URL,
		DEEPSEEK_URL,
		PERPLEXITY_URL,
		GEMINI_URL,
		GROK_URL,
	};

	for (const [name, url] of Object.entries(urlMap)) {
		it(`${name} is a non-empty https URL`, () => {
			expect(typeof url).toBe("string");
			expect(url.length).toBeGreaterThan(0);
			expect(url).toMatch(/^https:\/\//);
		});
	}

	it("all constants are unique", () => {
		const urls = Object.values(urlMap);
		const unique = new Set(urls);
		expect(unique.size).toBe(urls.length);
	});
});
