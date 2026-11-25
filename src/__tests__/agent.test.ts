import { describe, it, expect } from "vitest";
import { stripAnsiCodes, getAugmentedPath, findExecutable, buildCliArgs, parseClaudeStreamJsonLine } from "../services/AgentCliService";
import { AGENT_ENGINES, type AgentEngineKey } from "../types/agent";

describe("Agent types & registry", () => {
	it("has all expected engines registered", () => {
		const expectedKeys: AgentEngineKey[] = [
			"claude-cli",
			"antigravity-cli",
			"codex-cli",
			"anthropic-api",
			"openai-api",
			"ollama",
			"custom-cli",
		];
		const registeredKeys = AGENT_ENGINES.map((e) => e.key);
		expect(registeredKeys).toEqual(expect.arrayContaining(expectedKeys));
		expect(registeredKeys).toHaveLength(expectedKeys.length);
	});

	it("each engine has non-empty label, description, and badge", () => {
		for (const eng of AGENT_ENGINES) {
			expect(eng.label.trim().length).toBeGreaterThan(0);
			expect(eng.desc.trim().length).toBeGreaterThan(0);
			expect(eng.badge.trim().length).toBeGreaterThan(0);
			expect(["cli", "api"]).toContain(eng.type);
		}
	});

	it("claude-cli and antigravity-cli have expected default commands", () => {
		const claude = AGENT_ENGINES.find((e) => e.key === "claude-cli");
		const agy = AGENT_ENGINES.find((e) => e.key === "antigravity-cli");
		expect(claude?.defaultCommand).toBe("claude");
		expect(agy?.defaultCommand).toBe("agy");
	});
});

describe("AgentCliService utilities", () => {
	it("stripAnsiCodes removes color and style escape sequences", () => {
		const raw = "\u001b[32mHello\u001b[0m \u001b[1;34mWorld\u001b[0m\n\u001b[31mError message\u001b[0m";
		const clean = stripAnsiCodes(raw);
		expect(clean).toBe("Hello World\nError message");
	});

	it("stripAnsiCodes preserves plain text and markdown", () => {
		const md = "### Header\n\n```python\nprint('hello')\n```";
		expect(stripAnsiCodes(md)).toBe(md);
	});

	it("getAugmentedPath returns non-empty path string with bin directories", () => {
		const augmented = getAugmentedPath();
		expect(typeof augmented).toBe("string");
		expect(augmented.length).toBeGreaterThan(0);
		expect(augmented).toContain("/usr/bin");
	});

	it("findExecutable locates common system binaries like node or sh", () => {
		const shPath = findExecutable("sh");
		expect(shPath).not.toBeNull();
		expect(shPath).toContain("sh");
	});

	describe("buildCliArgs", () => {
		it("places --output-format text before -p for claude-cli", () => {
			const args = buildCliArgs("claude-cli", "Hello Claude");
			const formatIdx = args.indexOf("--output-format");
			const pIdx = args.indexOf("-p");
			expect(formatIdx).toBeGreaterThanOrEqual(0);
			expect(args[formatIdx + 1]).toBe("text");
			expect(pIdx).toBeGreaterThan(formatIdx);
			expect(args[pIdx + 1]).toBe("Hello Claude");
		});

		it("places --output-format text before -p for antigravity-cli", () => {
			const args = buildCliArgs("antigravity-cli", "Fix this issue");
			const formatIdx = args.indexOf("--output-format");
			const pIdx = args.indexOf("-p");
			expect(formatIdx).toBeGreaterThanOrEqual(0);
			expect(args[formatIdx + 1]).toBe("text");
			expect(pIdx).toBeGreaterThan(formatIdx);
			expect(args[pIdx + 1]).toBe("Fix this issue");
		});

		it("includes --dangerously-skip-permissions before -p when enabled", () => {
			const args = buildCliArgs("antigravity-cli", "Run check", {
				dangerouslySkipPermissions: true,
			});
			const permIdx = args.indexOf("--dangerously-skip-permissions");
			const pIdx = args.indexOf("-p");
			expect(permIdx).toBeGreaterThanOrEqual(0);
			expect(pIdx).toBeGreaterThan(permIdx);
			expect(args[pIdx + 1]).toBe("Run check");
		});

		it("places extra custom args before -p for CLI engines", () => {
			const args = buildCliArgs("claude-cli", "Explain code", {
				cliCustomArgs: "--verbose --model sonnet",
			});
			const pIdx = args.indexOf("-p");
			expect(args.indexOf("--verbose")).toBeLessThan(pIdx);
			expect(args.indexOf("--model")).toBeLessThan(pIdx);
			expect(args[pIdx + 1]).toBe("Explain code");
		});

		it("passes custom args and prompt directly for other engines", () => {
			const args = buildCliArgs("codex-cli", "Generate script", {
				cliCustomArgs: "--temp 0.2",
			});
			expect(args).not.toContain("-p");
			expect(args).not.toContain("--output-format");
			expect(args).toEqual(["--temp", "0.2", "Generate script"]);
		});

		it("supports stream-json output format with --verbose before -p", () => {
			const args = buildCliArgs("claude-cli", "Inspect repo", {
				outputFormat: "stream-json",
			});
			expect(args).toEqual(["--output-format", "stream-json", "--verbose", "-p", "Inspect repo"]);
		});
	});

	describe("parseClaudeStreamJsonLine", () => {
		it("extracts assistant text, thinking, and tool_use blocks", () => {
			const line = JSON.stringify({
				type: "assistant",
				message: {
					content: [
						{ type: "thinking", thinking: "Checking files..." },
						{ type: "tool_use", id: "tool_1", name: "Read", input: { path: "notes.md" } },
						{ type: "text", text: "Here is the summary." },
					],
				},
			});
			const parsed = parseClaudeStreamJsonLine(line);
			expect(parsed.thoughtDeltas).toEqual(["Checking files..."]);
			expect(parsed.textDeltas).toEqual(["Here is the summary."]);
			expect(parsed.toolEvents).toHaveLength(1);
			expect(parsed.toolEvents[0]).toMatchObject({
				id: "tool_1",
				name: "Read",
				status: "running",
			});
		});

		it("extracts tool_result completion and error states", () => {
			const line = JSON.stringify({
				type: "user",
				message: {
					content: [
						{ type: "tool_result", tool_use_id: "tool_1", content: "File read ok", is_error: false },
					],
				},
			});
			const parsed = parseClaudeStreamJsonLine(line);
			expect(parsed.toolEvents).toEqual([
				{ id: "tool_1", name: "tool", output: "File read ok", status: "done" },
			]);
		});

		it("falls back to raw text for non-JSON lines", () => {
			const parsed = parseClaudeStreamJsonLine("Plain CLI output");
			expect(parsed.textDeltas).toEqual(["Plain CLI output"]);
		});
	});
});
