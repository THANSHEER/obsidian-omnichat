import type { ThemeMode } from "../settings";

export interface ObsidianThemeTokens {
	isDark: boolean;
	backgroundPrimary: string;
	backgroundSecondary: string;
	backgroundSecondaryAlt: string;
	backgroundModifierBorder: string;
	backgroundModifierFormField: string;
	textNormal: string;
	textMuted: string;
	textFaint: string;
	interactiveAccent: string;
	interactiveAccentHover: string;
	textOnAccent: string;
	fontText: string;
	fontMonospace: string;
}

const DEFAULT_DARK_TOKENS: ObsidianThemeTokens = {
	isDark: true,
	backgroundPrimary: "#1e1e1e",
	backgroundSecondary: "#262626",
	backgroundSecondaryAlt: "#202020",
	backgroundModifierBorder: "#363636",
	backgroundModifierFormField: "#2a2a2a",
	textNormal: "#dadada",
	textMuted: "#a0a0a0",
	textFaint: "#666666",
	interactiveAccent: "#7f6df2",
	interactiveAccentHover: "#8b7cf6",
	textOnAccent: "#ffffff",
	fontText: "inherit",
	fontMonospace: "monospace",
};

const DEFAULT_LIGHT_TOKENS: ObsidianThemeTokens = {
	isDark: false,
	backgroundPrimary: "#ffffff",
	backgroundSecondary: "#f5f5f5",
	backgroundSecondaryAlt: "#eeeeee",
	backgroundModifierBorder: "#e0e0e0",
	backgroundModifierFormField: "#fafafa",
	textNormal: "#222222",
	textMuted: "#5c5c5c",
	textFaint: "#999999",
	interactiveAccent: "#7f6df2",
	interactiveAccentHover: "#6b59d8",
	textOnAccent: "#ffffff",
	fontText: "inherit",
	fontMonospace: "monospace",
};

function readCssVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
	const val = style.getPropertyValue(name).trim();
	return val || fallback;
}

/**
 * Reads live computed Obsidian theme tokens from `document.body` (or falls back
 * to clean defaults in non-DOM test environments), respecting `themeOverride`.
 */
export function getObsidianThemeTokens(themeOverride: ThemeMode = "auto"): ObsidianThemeTokens {
	const doc = typeof activeDocument !== "undefined" ? activeDocument : null;
	const hasDom = Boolean(doc?.body);
	const bodyIsDark = hasDom && doc ? doc.body.classList.contains("theme-dark") : true;
	const isDark = themeOverride === "auto" ? bodyIsDark : themeOverride === "dark";
	const defaults = isDark ? DEFAULT_DARK_TOKENS : DEFAULT_LIGHT_TOKENS;

	if (!hasDom || !doc || typeof getComputedStyle !== "function") {
		return { ...defaults, isDark };
	}

	const style = getComputedStyle(doc.body);

	// If user forced a theme opposite to Obsidian's current body class, keep crisp defaults for surfaces
	// while still inheriting Obsidian's accent & fonts.
	const matchesObsidianMode = isDark === bodyIsDark;

	return {
		isDark,
		backgroundPrimary: matchesObsidianMode
			? readCssVar(style, "--background-primary", defaults.backgroundPrimary)
			: defaults.backgroundPrimary,
		backgroundSecondary: matchesObsidianMode
			? readCssVar(style, "--background-secondary", defaults.backgroundSecondary)
			: defaults.backgroundSecondary,
		backgroundSecondaryAlt: matchesObsidianMode
			? readCssVar(style, "--background-secondary-alt", defaults.backgroundSecondaryAlt)
			: defaults.backgroundSecondaryAlt,
		backgroundModifierBorder: matchesObsidianMode
			? readCssVar(style, "--background-modifier-border", defaults.backgroundModifierBorder)
			: defaults.backgroundModifierBorder,
		backgroundModifierFormField: matchesObsidianMode
			? readCssVar(style, "--background-modifier-form-field", defaults.backgroundModifierFormField)
			: defaults.backgroundModifierFormField,
		textNormal: matchesObsidianMode
			? readCssVar(style, "--text-normal", defaults.textNormal)
			: defaults.textNormal,
		textMuted: matchesObsidianMode
			? readCssVar(style, "--text-muted", defaults.textMuted)
			: defaults.textMuted,
		textFaint: matchesObsidianMode
			? readCssVar(style, "--text-faint", defaults.textFaint)
			: defaults.textFaint,
		interactiveAccent: readCssVar(style, "--interactive-accent", defaults.interactiveAccent),
		interactiveAccentHover: readCssVar(style, "--interactive-accent-hover", defaults.interactiveAccentHover),
		textOnAccent: readCssVar(style, "--text-on-accent", defaults.textOnAccent),
		fontText: readCssVar(style, "--font-text", defaults.fontText),
		fontMonospace: readCssVar(style, "--font-monospace", defaults.fontMonospace),
	};
}

/**
 * Builds CSS that adapts common AI web apps (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Grok)
 * to Obsidian's active color palette without breaking site layout or interactive controls.
 */
export function buildWebviewThemeCss(tokens: ObsidianThemeTokens): string {
	const scheme = tokens.isDark ? "dark" : "light";
	return `
:root, html, body {
	color-scheme: ${scheme} !important;
	--omnichat-bg: ${tokens.backgroundPrimary};
	--omnichat-bg-secondary: ${tokens.backgroundSecondary};
	--omnichat-bg-alt: ${tokens.backgroundSecondaryAlt};
	--omnichat-border: ${tokens.backgroundModifierBorder};
	--omnichat-input-bg: ${tokens.backgroundModifierFormField};
	--omnichat-text: ${tokens.textNormal};
	--omnichat-text-muted: ${tokens.textMuted};
	--omnichat-accent: ${tokens.interactiveAccent};
	--omnichat-accent-hover: ${tokens.interactiveAccentHover};
	--omnichat-on-accent: ${tokens.textOnAccent};
}

html, body {
	background-color: var(--omnichat-bg) !important;
	color: var(--omnichat-text) !important;
}

/* ChatGPT / OpenAI surface variables */
:root {
	--main-surface-primary: var(--omnichat-bg) !important;
	--main-surface-secondary: var(--omnichat-bg-secondary) !important;
	--main-surface-tertiary: var(--omnichat-bg-alt) !important;
	--sidebar-surface-primary: var(--omnichat-bg-secondary) !important;
	--sidebar-surface-secondary: var(--omnichat-bg-alt) !important;
	--composer-surface: var(--omnichat-input-bg) !important;
	--border-light: var(--omnichat-border) !important;
	--border-medium: var(--omnichat-border) !important;
}

/* Claude.ai surface variables */
:root {
	--bg-000: var(--omnichat-bg) !important;
	--bg-100: var(--omnichat-bg) !important;
	--bg-200: var(--omnichat-bg-secondary) !important;
	--bg-300: var(--omnichat-bg-alt) !important;
	--text-000: var(--omnichat-text) !important;
	--text-100: var(--omnichat-text) !important;
	--text-200: var(--omnichat-text-muted) !important;
	--border-100: var(--omnichat-border) !important;
	--border-200: var(--omnichat-border) !important;
}

/* Gemini surface variables */
:root {
	--gem-sys-color--surface: var(--omnichat-bg) !important;
	--gem-sys-color--surface-container: var(--omnichat-bg-secondary) !important;
	--gem-sys-color--surface-container-high: var(--omnichat-bg-alt) !important;
	--gem-sys-color--on-surface: var(--omnichat-text) !important;
	--gem-sys-color--on-surface-variant: var(--omnichat-text-muted) !important;
	--gem-sys-color--outline: var(--omnichat-border) !important;
}

/* Generic app shells & navs */
main, [role="main"], #__next, #app {
	background-color: var(--omnichat-bg) !important;
}

aside, nav, [data-testid*="sidebar"] {
	background-color: var(--omnichat-bg-secondary) !important;
	border-color: var(--omnichat-border) !important;
}

pre, code {
	font-family: ${tokens.fontMonospace} !important;
}

/* Native-feeling Obsidian scrollbars inside webview */
::-webkit-scrollbar {
	width: 7px !important;
	height: 7px !important;
}
::-webkit-scrollbar-track {
	background: transparent !important;
}
::-webkit-scrollbar-thumb {
	background: color-mix(in srgb, ${tokens.textFaint} 35%, transparent) !important;
	border-radius: 9999px !important;
}
::-webkit-scrollbar-thumb:hover {
	background: color-mix(in srgb, ${tokens.textFaint} 60%, transparent) !important;
}
`.trim();
}

/**
 * Generates an idempotent JS snippet that injects or updates `<style id="omnichat-obsidian-theme">`
 * inside the embedded `<webview>` and toggles `.dark` / `data-theme` hints safely.
 */
export function buildWebviewThemeScript(tokens: ObsidianThemeTokens): string {
	const cssJson = JSON.stringify(buildWebviewThemeCss(tokens));
	const isDarkJson = JSON.stringify(tokens.isDark);
	return `
		(function() {
			try {
				var styleId = 'omnichat-obsidian-theme';
				var el = document.getElementById(styleId);
				if (!el) {
					el = document.createElement('style');
					el.id = styleId;
					(document.head || document.documentElement).appendChild(el);
				}
				el.textContent = ${cssJson};
				var isDark = ${isDarkJson};
				if (document.documentElement) {
					document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
				}
			} catch (e) {}
		})();
	`;
}

/**
 * Generates a JS snippet that removes the injected Obsidian theme `<style>` from the `<webview>`
 * when the user disables `adaptWebviewTheme`.
 */
export function buildClearWebviewThemeScript(): string {
	return `
		(function() {
			try {
				var el = document.getElementById('omnichat-obsidian-theme');
				if (el) el.remove();
				if (document.documentElement) {
					document.documentElement.style.colorScheme = '';
				}
			} catch (e) {}
		})();
	`;
}
