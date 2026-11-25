import { describe, it, expect } from "vitest";
import {
	buildClearWebviewThemeScript,
	buildWebviewThemeCss,
	buildWebviewThemeScript,
	getObsidianThemeTokens,
} from "../services/WebviewThemeService";

describe("WebviewThemeService", () => {
	it("returns dark and light default tokens when theme override is specified", () => {
		const dark = getObsidianThemeTokens("dark");
		const light = getObsidianThemeTokens("light");
		expect(dark.isDark).toBe(true);
		expect(light.isDark).toBe(false);
		expect(dark.backgroundPrimary).not.toBe(light.backgroundPrimary);
	});

	it("generates CSS mapping Obsidian tokens to web AI surfaces", () => {
		const tokens = getObsidianThemeTokens("dark");
		const css = buildWebviewThemeCss(tokens);
		expect(css).toContain("color-scheme: dark");
		expect(css).toContain("--main-surface-primary");
		expect(css).toContain("--bg-100");
		expect(css).toContain("--gem-sys-color--surface");
		expect(css).toContain(tokens.backgroundPrimary);
	});

	it("builds idempotent injection and cleanup scripts", () => {
		const script = buildWebviewThemeScript(getObsidianThemeTokens("light"));
		expect(script).toContain("omnichat-obsidian-theme");
		expect(script).toContain("colorScheme");

		const clearScript = buildClearWebviewThemeScript();
		expect(clearScript).toContain("omnichat-obsidian-theme");
		expect(clearScript).toContain("el.remove()");
	});
});
