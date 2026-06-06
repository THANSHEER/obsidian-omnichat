import { SERVICE_META, SERVICE_URLS, ServiceKey } from "./constants";

export function stripFrontmatterContent(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
}

export function normalizeUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return SERVICE_URLS.chatgpt;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

export function getServiceKey(url: string): ServiceKey | null {
	let hostname: string;
	try {
		hostname = new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
	for (const m of SERVICE_META) {
		if (m.hosts.some(h => h === hostname)) return m.key;
	}
	return null;
}

export function firstEnabled(flags: Record<ServiceKey, boolean>): ServiceKey | null {
	for (const key of Object.keys(SERVICE_URLS) as ServiceKey[]) {
		if (flags[key]) return key;
	}
	return null;
}

export function buildContextString(
	parts: string[],
	maxLength: number,
	prefix: string,
): { text: string; truncated: boolean } {
	let context = `--- Vault Context ---\n\n${parts.join("\n\n---\n\n")}\n\n--- End of Context ---\n\n`;
	let truncated = false;
	if (context.length > maxLength) {
		context = context.slice(0, maxLength) + "\n\n[Context truncated]\n\n";
		truncated = true;
	}
	const text = prefix.trim() ? `${prefix.trim()}\n\n${context}` : context;
	return { text, truncated };
}
