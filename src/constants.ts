export const CHATGPT_URL    = "https://chatgpt.com/";
export const CLAUDE_URL     = "https://claude.ai/";
export const DEEPSEEK_URL   = "https://chat.deepseek.com/";
export const PERPLEXITY_URL = "https://www.perplexity.ai/";
export const GEMINI_URL     = "https://gemini.google.com/app";
export const GROK_URL       = "https://grok.com/";

export const SERVICE_URLS = {
	chatgpt:    CHATGPT_URL,
	claude:     CLAUDE_URL,
	deepseek:   DEEPSEEK_URL,
	perplexity: PERPLEXITY_URL,
	gemini:     GEMINI_URL,
	grok:       GROK_URL,
} as const;

export type ServiceKey = keyof typeof SERVICE_URLS;
