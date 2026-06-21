import { describe, it, expect } from "vitest";
import {
	normalizeUrl,
	getServiceKey,
	firstEnabled,
	buildContextString,
	stripFrontmatterContent,
	splitFencedBlocks,
	reformatTables,
	wrapCodeLikeParagraphs,
	guessLanguage,
	formatAIResponseText,
} from "../utils";
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

// ── splitFencedBlocks ─────────────────────────────────────────────────────────

describe("splitFencedBlocks", () => {
	it("isolates a fenced code block from surrounding text", () => {
		const text = "before\n```\ncode here\n```\nafter";
		expect(splitFencedBlocks(text)).toEqual([
			{ type: "text", content: "before" },
			{ type: "fence", content: "```\ncode here\n```" },
			{ type: "text", content: "after" },
		]);
	});

	it("treats text with no fences as a single text segment", () => {
		const text = "just some plain text\nacross two lines";
		expect(splitFencedBlocks(text)).toEqual([{ type: "text", content: text }]);
	});

	it("keeps an unterminated fence as a fence segment", () => {
		const text = "before\n```\ndangling code";
		expect(splitFencedBlocks(text)).toEqual([
			{ type: "text", content: "before" },
			{ type: "fence", content: "```\ndangling code" },
		]);
	});
});

// ── reformatTables ────────────────────────────────────────────────────────────

describe("reformatTables", () => {
	it("converts a tab-separated block into a GFM table", () => {
		expect(reformatTables("Name\tAge\nAlice\t30\nBob\t25")).toBe(
			"| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |",
		);
	});

	it("converts a loosely pipe-separated block (no separator row) into a GFM table", () => {
		expect(reformatTables("Name | Age\nAlice | 30\nBob | 25")).toBe(
			"| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |",
		);
	});

	it("leaves an already-valid GFM table untouched (idempotent)", () => {
		const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
		expect(reformatTables(table)).toBe(table);
	});

	it("does not convert prose containing a single stray pipe character", () => {
		const prose =
			"Use the pipe operator like `ls | grep foo` to filter output.\n" +
			"This is helpful for many tasks.\n" +
			"Keep practicing this pattern.";
		expect(reformatTables(prose)).toBe(prose);
	});

	it("does not convert a two-line block (below the minimum row threshold)", () => {
		const text = "Name\tAge\nAlice\t30";
		expect(reformatTables(text)).toBe(text);
	});
});

// ── wrapCodeLikeParagraphs / guessLanguage ────────────────────────────────────

describe("guessLanguage", () => {
	it("detects python from a shebang", () => {
		expect(guessLanguage("#!/usr/bin/env python\nprint('hello')")).toBe("python");
	});

	it("detects bash from a shebang", () => {
		expect(guessLanguage("#!/bin/bash\necho hello")).toBe("bash");
	});

	it("detects json from parseable object text", () => {
		expect(guessLanguage('{"a": 1, "b": 2}')).toBe("json");
	});

	it("detects sql from SELECT/FROM keywords", () => {
		expect(guessLanguage("SELECT name, age FROM users WHERE age > 18")).toBe("sql");
	});

	it("detects js from function/return with semicolons", () => {
		expect(guessLanguage("function add(a, b) {\n  return a + b;\n}")).toBe("js");
	});

	it("returns null when no language signal is present", () => {
		expect(guessLanguage("Hello world\nThis has no code signals at all")).toBeNull();
	});
});

describe("wrapCodeLikeParagraphs", () => {
	it("wraps a code-like paragraph in a fenced block with a guessed language", () => {
		const code = "function add(a, b) {\n  return a + b;\n}";
		expect(wrapCodeLikeParagraphs(code)).toBe("```js\n" + code + "\n```");
	});

	it("does not wrap prose that merely mentions a code keyword once", () => {
		const prose =
			"The function keyword in JavaScript lets you define reusable blocks of logic.\n" +
			"This pattern is common across many languages.";
		expect(wrapCodeLikeParagraphs(prose)).toBe(prose);
	});

	it("does not re-wrap a paragraph that already looks like a finished GFM table", () => {
		const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
		expect(wrapCodeLikeParagraphs(table)).toBe(table);
	});
});

// ── formatAIResponseText ──────────────────────────────────────────────────────

describe("formatAIResponseText", () => {
	it("reconstructs an unfenced code paragraph and a loose table in the same text", () => {
		const input =
			"Intro line.\n\nName\tAge\nAlice\t30\nBob\t25\n\nfunction add(a, b) {\n  return a + b;\n}";
		const out = formatAIResponseText(input);
		expect(out).toContain("| Name | Age |");
		expect(out).toContain("| --- | --- |");
		expect(out).toContain("```js");
		expect(out).toContain("function add(a, b) {");
	});

	it("leaves an already-fenced code block untouched", () => {
		const input = "Some text before.\n\n```python\nprint('hi')\n```\n\nSome text after.";
		expect(formatAIResponseText(input)).toContain("```python\nprint('hi')\n```");
	});

	it("is idempotent", () => {
		const input = "Name\tAge\nAlice\t30\nBob\t25\n\nfunction add(a, b) {\n  return a + b;\n}";
		const once  = formatAIResponseText(input);
		const twice = formatAIResponseText(once);
		expect(twice).toBe(once);
	});

	it("does not alter plain prose with no code or table structure", () => {
		const input = "Just a normal paragraph of plain English text.\nNothing here looks like code or a table.";
		expect(formatAIResponseText(input)).toBe(input);
	});
});
