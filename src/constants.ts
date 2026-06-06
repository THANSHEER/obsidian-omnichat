export const CHATGPT_URL    = "https://chatgpt.com/";
export const CLAUDE_URL     = "https://claude.ai/";
export const DEEPSEEK_URL   = "https://chat.deepseek.com/";
export const PERPLEXITY_URL = "https://www.perplexity.ai/";
export const GEMINI_URL     = "https://gemini.google.com/app";
export const GROK_URL       = "https://grok.com/";
export const COPILOT_URL    = "https://copilot.microsoft.com/";
export const MANUS_URL      = "https://manus.im/";
export const KIMI_URL       = "https://kimi.ai/";

/** Names of the per-service enable toggles in DockSettings. */
export type ServiceEnableKey =
	| "enableChatGPT"
	| "enableClaude"
	| "enableDeepSeek"
	| "enablePerplexity"
	| "enableGemini"
	| "enableGrok"
	| "enableCopilot"
	| "enableManus"
	| "enableKimi";

/** One row of the built-in service registry. */
export interface ServiceMeta {
	readonly key: string;
	readonly label: string;
	readonly url: string;
	readonly hosts: readonly string[];
	readonly enableKey: ServiceEnableKey;
}

/**
 * Built-in AI services — the single source of truth. Everything else (URL map,
 * service selector, status bar, cycle, openers, commands, host→key detection)
 * is derived from this list. To add a service: append a row here, add the matching
 * enable flag to DockSettings/DEFAULT_SETTINGS, and add a `.vc-svc-dot--<key>`
 * colour in styles.css.
 */
export const SERVICE_META = [
	{ key: "chatgpt",    label: "ChatGPT",    url: CHATGPT_URL,    hosts: ["chatgpt.com", "chat.openai.com"],     enableKey: "enableChatGPT" },
	{ key: "claude",     label: "Claude",     url: CLAUDE_URL,     hosts: ["claude.ai"],                          enableKey: "enableClaude" },
	{ key: "deepseek",   label: "DeepSeek",   url: DEEPSEEK_URL,   hosts: ["chat.deepseek.com"],                  enableKey: "enableDeepSeek" },
	{ key: "perplexity", label: "Perplexity", url: PERPLEXITY_URL, hosts: ["www.perplexity.ai", "perplexity.ai"], enableKey: "enablePerplexity" },
	{ key: "gemini",     label: "Gemini",     url: GEMINI_URL,     hosts: ["gemini.google.com"],                  enableKey: "enableGemini" },
	{ key: "grok",       label: "Grok",       url: GROK_URL,       hosts: ["grok.com"],                           enableKey: "enableGrok" },
	{ key: "copilot",    label: "Copilot",    url: COPILOT_URL,    hosts: ["copilot.microsoft.com"],              enableKey: "enableCopilot" },
	{ key: "manus",      label: "Manus AI",   url: MANUS_URL,      hosts: ["manus.im"],                           enableKey: "enableManus" },
	{ key: "kimi",       label: "Kimi",       url: KIMI_URL,       hosts: ["kimi.ai"],                            enableKey: "enableKimi" },
] as const satisfies readonly ServiceMeta[];

export type ServiceKey = typeof SERVICE_META[number]["key"];

export const SERVICE_URLS = Object.fromEntries(
	SERVICE_META.map(m => [m.key, m.url]),
) as Record<ServiceKey, string>;
