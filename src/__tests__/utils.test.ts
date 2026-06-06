import { describe, it, expect } from "vitest";
import { normalizeUrl, getServiceKey, firstEnabled, buildContextString, stripFrontmatterContent } from "../utils";
import { SERVICE_URLS } from "../constants";

// ── normalizeUrl ──────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
	it("returns chatgpt URL for empty string", () => {
		expect(normalizeUrl("")).toBe(SERVICE_URLS.chatgpt);
	});

	it("returns chatgpt URL for whitespace-only string", () => {
		expect(normalizeUrl("   ")).toBe(SERVICE_URLS.chatgpt);
	});

	it("returns an https:// URL unchanged", () => {
		expect(normalizeUrl("https://claude.ai/")).toBe("https://claude.ai/");
	});

	it("returns an http:// URL unchanged", () => {
		expect(normalizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
	});

	it("prepends https:// when no protocol is present", () => {
		expect(normalizeUrl("example.com")).toBe("https://example.com");
	});

	it("trims leading and trailing whitespace before checking protocol", () => {
		expect(normalizeUrl("  https://claude.ai/  ")).toBe("https://claude.ai/");
	});

	it("handles URLs with paths and query strings", () => {
		expect(normalizeUrl("https://gemini.google.com/app?q=test")).toBe(
			"https://gemini.google.com/app?q=test",
		);
	});
});

// ── getServiceKey ─────────────────────────────────────────────────────────────

describe("getServiceKey", () => {
	it("identifies claude.ai as 'claude'", () => {
		expect(getServiceKey("https://claude.ai/")).toBe("claude");
	});

	it("identifies chatgpt.com as 'chatgpt'", () => {
		expect(getServiceKey("https://chatgpt.com/")).toBe("chatgpt");
	});

	it("identifies chat.openai.com as 'chatgpt'", () => {
		expect(getServiceKey("https://chat.openai.com/")).toBe("chatgpt");
	});

	it("identifies chat.deepseek.com as 'deepseek'", () => {
		expect(getServiceKey("https://chat.deepseek.com/")).toBe("deepseek");
	});

	it("identifies perplexity.ai as 'perplexity'", () => {
		expect(getServiceKey("https://www.perplexity.ai/")).toBe("perplexity");
	});

	it("identifies gemini.google.com as 'gemini'", () => {
		expect(getServiceKey("https://gemini.google.com/app")).toBe("gemini");
	});

	it("identifies grok.com as 'grok'", () => {
		expect(getServiceKey("https://grok.com/")).toBe("grok");
	});

	it("returns null for an unrecognised URL", () => {
		expect(getServiceKey("https://example.com")).toBeNull();
	});

	it("is case-insensitive", () => {
		expect(getServiceKey("HTTPS://CLAUDE.AI/")).toBe("claude");
	});

	it("does not match deepseek.com (without 'chat.' prefix) as deepseek", () => {
		// deepseek.com without the chat subdomain is not the chat UI
		expect(getServiceKey("https://deepseek.com")).toBeNull();
	});
});

// ── firstEnabled ──────────────────────────────────────────────────────────────

describe("firstEnabled", () => {
	const allOn  = { chatgpt: true,  claude: true,  deepseek: true,  perplexity: true,  gemini: true,  grok: true  };
	const allOff = { chatgpt: false, claude: false, deepseek: false, perplexity: false, gemini: false, grok: false };

	it("returns 'chatgpt' (first key) when all services are enabled", () => {
		expect(firstEnabled(allOn)).toBe("chatgpt");
	});

	it("returns null when all services are disabled", () => {
		expect(firstEnabled(allOff)).toBeNull();
	});

	it("returns the sole enabled service", () => {
		expect(firstEnabled({ ...allOff, grok: true })).toBe("grok");
	});

	it("returns the first enabled service when several are enabled", () => {
		// SERVICE_URLS key order: chatgpt, claude, deepseek, perplexity, gemini, grok
		expect(firstEnabled({ ...allOff, claude: true, gemini: true })).toBe("claude");
	});

	it("skips disabled leading services", () => {
		expect(firstEnabled({ ...allOff, deepseek: true })).toBe("deepseek");
	});
});

// ── buildContextString ────────────────────────────────────────────────────────

describe("buildContextString", () => {
	it("wraps parts in vault context markers", () => {
		const { text } = buildContextString(["Note A"], 100_000, "");
		expect(text).toContain("--- Vault Context ---");
		expect(text).toContain("--- End of Context ---");
		expect(text).toContain("Note A");
	});

	it("joins multiple parts with a --- separator", () => {
		const { text } = buildContextString(["Note A", "Note B"], 100_000, "");
		expect(text).toContain("Note A");
		expect(text).toContain("Note B");
		// separator between parts
		expect(text).toContain("Note A\n\n---\n\nNote B");
	});

	it("prepends a non-empty prefix", () => {
		const { text } = buildContextString(["Note A"], 100_000, "My instruction:");
		expect(text.startsWith("My instruction:")).toBe(true);
	});

	it("trims the prefix before prepending", () => {
		const { text } = buildContextString(["Note A"], 100_000, "  Instruction  ");
		expect(text.startsWith("Instruction")).toBe(true);
	});

	it("does not prepend an empty prefix", () => {
		const { text } = buildContextString(["Note A"], 100_000, "");
		expect(text.startsWith("--- Vault Context ---")).toBe(true);
	});

	it("does not prepend a whitespace-only prefix", () => {
		const { text } = buildContextString(["Note A"], 100_000, "   ");
		expect(text.startsWith("--- Vault Context ---")).toBe(true);
	});

	it("reports truncated=false when content fits within maxLength", () => {
		const { truncated } = buildContextString(["short note"], 100_000, "");
		expect(truncated).toBe(false);
	});

	it("reports truncated=true when content exceeds maxLength", () => {
		const { truncated } = buildContextString(["A".repeat(200)], 50, "");
		expect(truncated).toBe(true);
	});

	it("appends [Context truncated] marker when truncated", () => {
		const { text } = buildContextString(["A".repeat(200)], 50, "");
		expect(text).toContain("[Context truncated]");
	});

	it("truncated text length equals maxLength + truncation suffix length", () => {
		const suffix = "\n\n[Context truncated]\n\n";
		const { text } = buildContextString(["A".repeat(1000)], 100, "");
		expect(text.length).toBe(100 + suffix.length);
	});

	it("prefix is not included in the maxLength slice (prefix is added after)", () => {
		// prefix + context should both be in the output
		const { text, truncated } = buildContextString(["A".repeat(1000)], 100, "PREFIX");
		expect(truncated).toBe(true);
		expect(text.startsWith("PREFIX")).toBe(true);
	});
});

// ── stripFrontmatterContent ─────────────────────────────────────────────────────

describe("stripFrontmatterContent", () => {
	it("removes a leading YAML frontmatter block", () => {
		expect(stripFrontmatterContent("---\ntitle: Note\ntags: [a]\n---\nBody text")).toBe("Body text");
	});

	it("returns content unchanged when there is no frontmatter", () => {
		expect(stripFrontmatterContent("# Heading\n\nSome text")).toBe("# Heading\n\nSome text");
	});

	it("handles CRLF line endings", () => {
		expect(stripFrontmatterContent("---\r\ntitle: Note\r\n---\r\nBody")).toBe("Body");
	});

	it("trims blank lines left after the frontmatter block", () => {
		expect(stripFrontmatterContent("---\na: b\n---\n\n\nBody")).toBe("Body");
	});

	it("does not strip a '---' divider that is not at the very start", () => {
		const input = "Intro paragraph\n\n---\n\nNext section";
		expect(stripFrontmatterContent(input)).toBe(input);
	});
});
