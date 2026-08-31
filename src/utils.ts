import { Platform } from "obsidian";
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

// ── AI response formatting (code blocks / tables) ──────────

export interface TextSegment {
	type: "fence" | "text";
	content: string;
}

const FENCE_RE = /^(\s*)(`{3,}|~{3,})/;

/** Splits text on fenced code blocks so already-fenced content is never re-processed. */
export function splitFencedBlocks(text: string): TextSegment[] {
	const lines = text.split("\n");
	const segments: TextSegment[] = [];
	let buffer: string[] = [];
	let inFence = false;
	let fenceChar = "";
	let fenceLen = 0;

	const flush = (type: "fence" | "text"): void => {
		if (buffer.length === 0) return;
		segments.push({ type, content: buffer.join("\n") });
		buffer = [];
	};

	for (const line of lines) {
		const match  = FENCE_RE.exec(line);
		const marker = match?.[2] ?? "";
		if (!inFence && match) {
			flush("text");
			inFence    = true;
			fenceChar  = marker[0] ?? "";
			fenceLen   = marker.length;
			buffer.push(line);
		} else if (inFence && match && marker[0] === fenceChar && marker.length >= fenceLen) {
			buffer.push(line);
			flush("fence");
			inFence = false;
		} else {
			buffer.push(line);
		}
	}
	flush(inFence ? "fence" : "text");

	return segments;
}

/** Applies `fn` to each blank-line-separated paragraph, leaving the blank-line separators untouched. */
function mapParagraphs(segment: string, fn: (paragraph: string) => string): string {
	const parts = segment.split(/(\n[ \t]*\n)/);
	return parts.map((part, i) => (i % 2 === 0 ? fn(part) : part)).join("");
}

const TABLE_SEPARATOR_RE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/;
const MIN_TABLE_DATA_ROWS = 2;
const MIN_TABLE_COLUMNS = 2;

function isAlreadyTable(paragraph: string): boolean {
	const lines = paragraph.split("\n");
	return lines.length >= 2 && TABLE_SEPARATOR_RE.test((lines[1] ?? "").trim());
}

type TableDelimiter = "tab" | "pipe" | "space";

function detectTableDelimiter(lines: string[]): TableDelimiter | null {
	if (lines.every(l => l.includes("\t"))) return "tab";
	if (lines.every(l => l.includes("|"))) return "pipe";
	if (lines.every(l => /\S\s{2,}\S/.test(l))) return "space";
	return null;
}

function splitRow(line: string, delimiter: TableDelimiter): string[] {
	const parts =
		delimiter === "tab" ? line.split("\t") :
		delimiter === "pipe" ? line.split("|") :
		line.split(/\s{2,}/);
	return parts.map(p => p.trim()).filter(p => p.length > 0);
}

function modeOf(nums: number[]): number {
	const freq = new Map<number, number>();
	for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);
	let best = nums[0] ?? 0;
	let bestCount = 0;
	for (const [val, count] of freq) {
		if (count > bestCount) { best = val; bestCount = count; }
	}
	return best;
}

/** Reconstructs loosely-delimited (tab/pipe/space) text as a GFM table. Leaves valid tables untouched. */
export function reformatTables(segment: string): string {
	return mapParagraphs(segment, paragraph => {
		if (!paragraph.trim()) return paragraph;
		const lines = paragraph.split("\n");
		if (lines.length < MIN_TABLE_DATA_ROWS + 1) return paragraph;
		if (isAlreadyTable(paragraph)) return paragraph;

		const delimiter = detectTableDelimiter(lines);
		if (!delimiter) return paragraph;

		const rows = lines.map(line => splitRow(line, delimiter));
		const counts = rows.map(r => r.length);
		const mode = modeOf(counts);
		if (mode < MIN_TABLE_COLUMNS || !counts.every(c => c === mode)) return paragraph;

		const header   = rows[0] ?? [];
		const dataRows = rows.slice(1);
		const separator = new Array(mode).fill("---") as string[];
		return [header, separator, ...dataRows].map(r => `| ${r.join(" | ")} |`).join("\n");
	});
}

const CODE_KEYWORDS = [
	"function", "const", "let", "var", "def", "class", "import", "return",
	"#include", "select", "public", "private", "func", "fn", "package",
];
const CODE_SCORE_THRESHOLD = 3;

function codeLikelihoodScore(paragraph: string): number {
	const lines = paragraph.split("\n").filter(l => l.trim().length > 0);
	if (lines.length < 2) return 0;

	let score = 0;

	if (/^#!/.test((lines[0] ?? "").trim())) score += 4;

	const endingSignals = lines.filter(l => /[;{}]\s*$/.test(l) || /:\s*$/.test(l.trim())).length;
	if (endingSignals >= 2) score += 2;

	const bracketCount = (paragraph.match(/[{}()[\]]/g) ?? []).length;
	if (bracketCount >= lines.length) score += 1;

	const keywordHits = CODE_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, "i").test(paragraph)).length;
	if (keywordHits >= 1) score += 2;
	if (keywordHits >= 2) score += 1;

	const indentedCount = lines.filter(l => /^[ \t]+/.test(l)).length;
	if (indentedCount >= 2 && indentedCount >= Math.ceil(lines.length / 2)) score += 1;

	const sentenceEndings = (paragraph.match(/[a-z]\.\s+[A-Z]/g) ?? []).length;
	score -= sentenceEndings;

	return score;
}

/** Guesses a fence language tag for code already identified as code-like. Returns null rather than guessing wrong. */
export function guessLanguage(code: string): string | null {
	const trimmed = code.trim();
	const firstLine = (trimmed.split("\n")[0] ?? "").trim();

	if (/^#!.*python/.test(firstLine)) return "python";
	if (/^#!/.test(firstLine)) return "bash";

	if (/^[{[]/.test(trimmed)) {
		try {
			JSON.parse(trimmed);
			return "json";
		} catch {
			// not JSON — fall through to other checks
		}
	}

	if (/\bdef\s+\w+\s*\(/.test(trimmed) || /\bprint\(/.test(trimmed)) return "python";

	if (/\b(select|insert into|update|delete from)\b/i.test(trimmed) && /\bfrom\b/i.test(trimmed)) return "sql";

	if (/<\/?[a-z]/i.test(trimmed) && /<html|<div|<body|<span/i.test(trimmed)) return "html";

	if (/\bfn\s+\w+\s*\(/.test(trimmed) || /\blet mut\b/.test(trimmed)) return "rust";
	if (/\bfunc\s+\w+\s*\(/.test(trimmed) && /\bpackage\s+\w+/.test(trimmed)) return "go";
	if (/\bpublic\s+(static\s+)?class\b/.test(trimmed) || /public\s+static\s+void\s+main/.test(trimmed)) return "java";
	if (/#include\s*</.test(trimmed)) return "c";

	if (/\b(function|const|let|var)\b/.test(trimmed) && /;\s*$/m.test(trimmed)) {
		if (/:\s*(string|number|boolean|any)\b/.test(trimmed) || /\binterface\s+\w+/.test(trimmed)) return "ts";
		return "js";
	}

	return null;
}

/** Wraps paragraphs that score as code-like in fenced code blocks, with a best-effort language tag. */
export function wrapCodeLikeParagraphs(segment: string): string {
	return mapParagraphs(segment, paragraph => {
		if (!paragraph.trim()) return paragraph;
		if (isAlreadyTable(paragraph)) return paragraph;
		if (codeLikelihoodScore(paragraph) < CODE_SCORE_THRESHOLD) return paragraph;

		const lang = guessLanguage(paragraph) ?? "";
		return `\`\`\`${lang}\n${paragraph}\n\`\`\``;
	});
}

/**
 * Reconstructs markdown structure (tables, code blocks) lost when copying an AI
 * response from a chat site's clipboard. Idempotent — already-fenced code and
 * already-valid tables pass through unchanged.
 */
export function formatAIResponseText(text: string): string {
	const segments = splitFencedBlocks(text);
	return segments
		.map(seg => (seg.type === "fence" ? seg.content : wrapCodeLikeParagraphs(reformatTables(seg.content))))
		.join("\n");
}

/**
 * Browser-like User-Agent for the embedded webview.
 * Keeps the host OS (Windows / macOS / Linux) and Chrome version from Obsidian's
 * Chromium, but strips Electron/Obsidian tokens that AI sites use to block embeds.
 */
export function getCleanUserAgent(ua: string = ""): string {
	const hostUa = ua.trim() || (typeof navigator !== "undefined" ? navigator["userAgent"] : "");
	const cleaned = hostUa
		.replace(/\s*Electron\/[\d.]+/gi, "")
		.replace(/\s*obsidian\/[\d.]+/gi, "")
		.replace(/\s+/g, " ")
		.trim();

	if (/Mozilla\/5\.0/.test(cleaned) && /Chrome\/[\d.]+/.test(cleaned)) {
		return cleaned;
	}

	const osToken = Platform.isWin
		? "Windows NT 10.0; Win64; x64"
		: Platform.isLinux
			? "X11; Linux x86_64"
			: "Macintosh; Intel Mac OS X 10_15_7";
	const chromeVer = hostUa.match(/Chrome\/([\d.]+)/)?.[1] ?? "133.0.0.0";
	return `Mozilla/5.0 (${osToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
}

/**
 * Generates modern Chrome Client Hints matching the cleaned User-Agent.
 */
export function getChromeClientHints(ua: string = ""): {
	secChUa: string;
	secChUaMobile: string;
	secChUaPlatform: string;
} {
	const userAgent = getCleanUserAgent(ua);
	const match = userAgent.match(/Chrome\/(\d+)/);
	const major = match ? match[1] : "133";
	const isWin = /Windows/i.test(userAgent);
	const isMac = /Macintosh|Mac OS/i.test(userAgent);

	return {
		secChUa: `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not:A-Brand";v="99"`,
		secChUaMobile: "?0",
		secChUaPlatform: isWin ? '"Windows"' : isMac ? '"macOS"' : '"Linux"',
	};
}

/**
 * Stealth script injected into the webview to ensure JavaScript environment
 * properties (window.chrome, navigator.webdriver, etc.) match a genuine Google Chrome browser.
 */
export function getChromeStealthScript(): string {
	return `
		(function() {
			try {
				// 1. Mask navigator.webdriver
				if (Object.defineProperty) {
					try {
						Object.defineProperty(navigator, 'webdriver', {
							get: function() { return undefined; },
							configurable: true
						});
					} catch(e) {}
				}

				// 2. Mock window.chrome runtime, app, csi, loadTimes
				if (!window.chrome) {
					window.chrome = {};
				}
				if (!window.chrome.app) {
					window.chrome.app = {
						isInstalled: false,
						InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
						RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
						getDetails: function() { return null; },
						getIsInstalled: function() { return false; },
						installState: function() { return "not_installed"; },
						runningState: function() { return "cannot_run"; }
					};
				}
				if (!window.chrome.runtime) {
					window.chrome.runtime = {
						OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
						OnRestartRequired: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
						PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
						PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
						PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
						RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
						connect: function() { return { disconnect: function() {}, onDisconnect: { addListener: function() {} }, onMessage: { addListener: function() {} }, postMessage: function() {} }; },
						sendMessage: function() {}
					};
				}
				if (!window.chrome.csi) {
					window.chrome.csi = function() {
						return { startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 };
					};
				}
				if (!window.chrome.loadTimes) {
					window.chrome.loadTimes = function() {
						return {
							commitLoadTime: Date.now() / 1000,
							connectionInfo: "http/1.1",
							finishDocumentLoadTime: Date.now() / 1000,
							finishLoadTime: Date.now() / 1000,
							firstPaintAfterLoadTime: 0,
							firstPaintTime: Date.now() / 1000,
							navigationType: "Other",
							npnNegotiatedProtocol: "unknown",
							requestTime: Date.now() / 1000,
							startLoadTime: Date.now() / 1000,
							wasAlternateProtocolAvailable: false,
							wasFetchedViaSpdy: false,
							wasNpnNegotiated: false
						};
					};
				}

				// 3. Ensure navigator.languages is properly populated
				if (!navigator.languages || navigator.languages.length === 0) {
					try {
						Object.defineProperty(navigator, 'languages', {
							get: function() { return [navigator.language || 'en-US', 'en']; },
							configurable: true
						});
					} catch(e) {}
				}
			} catch(e) {}
		})();
	`;
}

/**
 * Safely checks if a hostname matches a domain or is a valid subdomain of it.
 * Avoids substring false positives flagged by security scanners (e.g. CodeQL).
 */
export function isHostOrSubdomain(hostname: string, domain: string): boolean {
	const h = hostname.toLowerCase();
	const d = domain.toLowerCase();
	return h === d || h.endsWith(`.${d}`);
}

const KNOWN_AUTH_DOMAINS = [
	"appleid.apple.com",
	"login.microsoftonline.com",
	"login.live.com",
	"auth0.com",
	"clerk.com",
	"firebaseapp.com",
	"okta.com",
	"amazoncognito.com",
] as const;

/**
 * Checks if a given URL is an OAuth or authentication endpoint that should be handled
 * via the dedicated Auth modal rather than external browser.
 */
export function isAuthUrl(url: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname.toLowerCase();

		// Google accounts OAuth domains (e.g. accounts.google.com, accounts.google.co.uk)
		if (host === "accounts.google.com" || host.endsWith(".accounts.google.com") || /^accounts\.google\.[a-z.]+$/i.test(host)) {
			return true;
		}

		// Well-known auth provider domains
		for (const domain of KNOWN_AUTH_DOMAINS) {
			if (isHostOrSubdomain(host, domain)) {
				return true;
			}
		}

		// Service specific auth paths / subdomains
		if (
			isHostOrSubdomain(host, "perplexity.ai") &&
			(path.startsWith("/auth") || path.startsWith("/login") || path.startsWith("/signin") || path.startsWith("/api/auth"))
		) {
			return true;
		}

		if (
			(isHostOrSubdomain(host, "chatgpt.com") || isHostOrSubdomain(host, "openai.com")) &&
			(path.startsWith("/auth") || path.startsWith("/login") || host.startsWith("auth."))
		) {
			return true;
		}

		if (
			(isHostOrSubdomain(host, "claude.ai") || isHostOrSubdomain(host, "anthropic.com")) &&
			(path.startsWith("/login") || path.startsWith("/auth") || host.startsWith("auth."))
		) {
			return true;
		}

		// Generic OAuth / login keywords in URL path or query parameters
		if (
			path.includes("/oauth") ||
			path.includes("/login/oauth") ||
			path.includes("/api/auth") ||
			path.includes("/v1/auth") ||
			parsed.searchParams.has("response_type") ||
			parsed.searchParams.has("client_id") ||
			parsed.searchParams.has("redirect_uri")
		) {
			return true;
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Checks if a URL is a Google Auth / account login URL.
 */
export function isGoogleAuthUrl(url: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		return host === "accounts.google.com" ||
			host.endsWith(".accounts.google.com") ||
			/^accounts\.google\.[a-z.]+$/i.test(host) ||
			host === "myaccount.google.com" ||
			host.endsWith(".myaccount.google.com") ||
			/^myaccount\.google\.[a-z.]+$/i.test(host);
	} catch {
		return false;
	}
}

/**
 * Generates a clean Firefox User-Agent matching the host platform/OS.
 */
export function getFirefoxUserAgent(ua: string = ""): string {
	const hostUa = ua.trim() || (typeof navigator !== "undefined" ? navigator["userAgent"] : "");
	const isWin = /Windows/i.test(hostUa) || (typeof Platform !== "undefined" && Platform.isWin);
	const isLinux = /Linux/i.test(hostUa) || (typeof Platform !== "undefined" && Platform.isLinux);

	const osToken = isWin
		? "Windows NT 10.0; Win64; x64"
		: isLinux
			? "X11; Linux x86_64"
			: "Macintosh; Intel Mac OS X 10.15";

	return `Mozilla/5.0 (${osToken}; rv:130.0) Gecko/20100101 Firefox/130.0`;
}

