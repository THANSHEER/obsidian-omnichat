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
	getCleanUserAgent,
	getChromeClientHints,
	getChromeStealthScript,
	isAuthUrl,
	isHostOrSubdomain,
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

// ── getCleanUserAgent ─────────────────────────────────────────────────────────

describe("getCleanUserAgent", () => {
	it("keeps Windows OS and Chrome version while stripping Electron/Obsidian", () => {
		const input =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.91 Electron/33.2.0 obsidian/1.8.0 Safari/537.36";
		const out = getCleanUserAgent(input);
		expect(out).toContain("Windows NT 10.0; Win64; x64");
		expect(out).toContain("Chrome/130.0.6723.91");
		expect(out).not.toMatch(/Electron/i);
		expect(out).not.toMatch(/obsidian/i);
	});

	it("keeps macOS OS token from the host UA", () => {
		const input =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.84 Electron/31.0.0 Safari/537.36";
		const out = getCleanUserAgent(input);
		expect(out).toContain("Macintosh; Intel Mac OS X 10_15_7");
		expect(out).toContain("Chrome/128.0.6613.84");
		expect(out).not.toMatch(/Electron/i);
	});

	it("keeps Linux OS token from the host UA", () => {
		const input =
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Electron/32.0.0 Safari/537.36";
		expect(getCleanUserAgent(input)).toContain("X11; Linux x86_64");
	});

	it("falls back to a Platform-based Chrome UA when host UA is unusable", () => {
		// Platform mock defaults to macOS.
		expect(getCleanUserAgent("")).toContain("Macintosh; Intel Mac OS X");
		expect(getCleanUserAgent("")).toContain("Chrome/133.0.0.0");
	});
});

// ── getChromeClientHints ──────────────────────────────────────────────────────

describe("getChromeClientHints", () => {
	it("extracts matching major version and platform from User-Agent", () => {
		const ua =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36";
		const hints = getChromeClientHints(ua);
		expect(hints.secChUa).toContain('"Google Chrome";v="131"');
		expect(hints.secChUa).toContain('"Chromium";v="131"');
		expect(hints.secChUaMobile).toBe("?0");
		expect(hints.secChUaPlatform).toBe('"Windows"');
	});

	it("identifies macOS platform correctly", () => {
		const ua =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
		const hints = getChromeClientHints(ua);
		expect(hints.secChUaPlatform).toBe('"macOS"');
	});
});

// ── getChromeStealthScript ────────────────────────────────────────────────────

describe("getChromeStealthScript", () => {
	it("returns a self-executing JS function string", () => {
		const script = getChromeStealthScript();
		expect(script).toContain("window.chrome");
		expect(script).toContain("webdriver");
		expect(script).toContain("loadTimes");
		expect(script).toContain("csi");
	});
});

// ── isHostOrSubdomain ─────────────────────────────────────────────────────────

describe("isHostOrSubdomain", () => {
	it("returns true for exact domain match", () => {
		expect(isHostOrSubdomain("appleid.apple.com", "appleid.apple.com")).toBe(true);
		expect(isHostOrSubdomain("perplexity.ai", "perplexity.ai")).toBe(true);
	});

	it("returns true for legitimate subdomains", () => {
		expect(isHostOrSubdomain("auth.perplexity.ai", "perplexity.ai")).toBe(true);
		expect(isHostOrSubdomain("sub.auth.openai.com", "openai.com")).toBe(true);
	});

	it("returns false for domain poisoning / substring attacks (CodeQL safe)", () => {
		expect(isHostOrSubdomain("evilappleid.apple.com", "appleid.apple.com")).toBe(false);
		expect(isHostOrSubdomain("notopenai.com", "openai.com")).toBe(false);
		expect(isHostOrSubdomain("perplexity.ai.attacker.com", "perplexity.ai")).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isHostOrSubdomain("APPLEID.APPLE.COM", "appleid.apple.com")).toBe(true);
	});
});

// ── isAuthUrl ─────────────────────────────────────────────────────────────────

describe("isAuthUrl", () => {
	it("identifies Google OAuth accounts URLs", () => {
		expect(isAuthUrl("https://accounts.google.com/o/oauth2/v2/auth?client_id=123")).toBe(true);
		expect(isAuthUrl("https://accounts.google.co.uk/signin/v2")).toBe(true);
	});

	it("identifies Microsoft & Apple login URLs", () => {
		expect(isAuthUrl("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")).toBe(true);
		expect(isAuthUrl("https://appleid.apple.com/auth/authorize")).toBe(true);
	});

	it("identifies Perplexity auth endpoints", () => {
		expect(isAuthUrl("https://www.perplexity.ai/api/auth/signin/google")).toBe(true);
		expect(isAuthUrl("https://www.perplexity.ai/auth/login")).toBe(true);
	});

	it("identifies generic OAuth parameters", () => {
		expect(isAuthUrl("https://example.com/oauth/authorize?response_type=code&client_id=xyz")).toBe(true);
	});

	it("returns false for regular external documentation or article URLs", () => {
		expect(isAuthUrl("https://en.wikipedia.org/wiki/Artificial_intelligence")).toBe(false);
		expect(isAuthUrl("https://github.com/obsidianmd/obsidian-api")).toBe(false);
		expect(isAuthUrl("https://news.ycombinator.com/")).toBe(false);
	});

	it("rejects malicious URLs attempting substring domain spoofing", () => {
		expect(isAuthUrl("https://evilappleid.apple.com/login")).toBe(false);
		expect(isAuthUrl("https://notopenai.com/auth")).toBe(false);
	});
});


