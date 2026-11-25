import { moment } from "obsidian";
import { en, type LocaleDict, type LocaleKey } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

export type { LocaleDict, LocaleKey };

export interface LocaleMeta {
	code: string;
	nativeLabel: string;
	englishLabel: string;
}

/**
 * Registry of all bundled locales.
 * To add a new language:
 *   1. Create `src/i18n/locales/<code>.ts` exporting `LocaleDict`
 *   2. Add it to `SUPPORTED_LOCALES` and `LOCALES` below
 */
export const SUPPORTED_LOCALES: LocaleMeta[] = [
	{ code: "en", nativeLabel: "English", englishLabel: "English" },
	{ code: "zh-CN", nativeLabel: "简体中文", englishLabel: "Simplified Chinese" },
];

export const LOCALES: Record<string, LocaleDict> = {
	en,
	"zh-CN": zhCN,
};

const LOCALE_ALIASES: Record<string, string> = {
	zh: "zh-CN",
	"zh-cn": "zh-CN",
	"zh_cn": "zh-CN",
	"zh-hans": "zh-CN",
	"zh-sg": "zh-CN",
};

let activeLocale = "en";

/**
 * Maps an Obsidian / user locale string (e.g. "zh", "zh-CN", "zh-Hans", "en-US")
 * to one of the registered locale codes, falling back to "en".
 */
export function normalizeLocale(raw?: string): string {
	if (!raw) return "en";
	const cleaned = raw.trim();
	if (!cleaned) return "en";

	if (LOCALES[cleaned]) return cleaned;

	const lower = cleaned.toLowerCase();
	if (LOCALE_ALIASES[lower]) return LOCALE_ALIASES[lower];

	const exactInsensitive = Object.keys(LOCALES).find((k) => k.toLowerCase() === lower);
	if (exactInsensitive) return exactInsensitive;

	const base = lower.split(/[-_]/)[0] ?? "";
	if (LOCALE_ALIASES[base]) return LOCALE_ALIASES[base];
	const baseMatch = Object.keys(LOCALES).find((k) => k.toLowerCase() === base);
	return baseMatch ?? "en";
}

function detectObsidianLanguage(): string {
	try {
		if (typeof moment?.locale === "function") {
			const loc = moment.locale();
			if (typeof loc === "string" && loc) return loc;
		}
	} catch {
		// Outside Obsidian runtime (e.g. unit tests)
	}
	return "en";
}

/**
 * Sets the active locale. Pass `"auto"` (or omit) to follow Obsidian's language.
 */
export function setLocale(preferred?: string): string {
	const raw = !preferred || preferred === "auto" ? detectObsidianLanguage() : preferred;
	activeLocale = normalizeLocale(raw);
	return activeLocale;
}

export function getActiveLocale(): string {
	return activeLocale;
}

/**
 * Translates a UI key in the active locale, falling back to English.
 * Supports `{placeholder}` variable interpolation.
 */
export function t(key: LocaleKey, vars?: Record<string, string | number>): string {
	let text = LOCALES[activeLocale]?.[key] ?? en[key] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
		}
	}
	return text;
}
