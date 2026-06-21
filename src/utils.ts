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
