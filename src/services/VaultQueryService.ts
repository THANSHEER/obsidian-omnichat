import { App, TFile } from "obsidian";

export interface VaultNoteContext {
	file: TFile;
	score: number;
	snippet: string;
	title: string;
	path: string;
}

export interface VaultSearchOptions {
	maxNotes?: number;
	maxCharsPerNote?: number;
}

const STOP_WORDS = new Set([
	"a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
	"by", "about", "against", "between", "into", "through", "during", "before",
	"after", "above", "below", "from", "up", "down", "is", "are", "was", "were",
	"be", "been", "being", "have", "has", "had", "do", "does", "did", "can",
	"could", "will", "would", "should", "what", "which", "who", "when", "where",
	"why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
	"some", "such", "no", "nor", "not", "only", "own", "same", "so", "than",
	"too", "very", "vault", "note", "notes", "obsidian", "my", "me", "tell",
	"find", "show", "search", "explain", "summarize", "list", "give",
]);

export function extractSearchKeywords(query: string): string[] {
	return query
		.toLowerCase()
		.replace(/[^\w\s-]/g, " ")
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export class VaultQueryService {
	public static async queryVault(
		app: App,
		query: string,
		options: VaultSearchOptions = {},
	): Promise<VaultNoteContext[]> {
		const maxNotes = options.maxNotes ?? 4;
		const maxChars = options.maxCharsPerNote ?? 2000;

		const keywords = extractSearchKeywords(query);
		const files = app.vault.getMarkdownFiles();
		if (!files.length) return [];

		// If no specific keywords were extracted, fallback to all words > 2 chars
		const effectiveKeywords =
			keywords.length > 0
				? keywords
				: query
						.toLowerCase()
						.split(/\s+/)
						.filter((w) => w.length >= 2);

		if (!effectiveKeywords.length) return [];

		const scored: { file: TFile; score: number }[] = [];

		for (const file of files) {
			let score = 0;
			const nameLower = file.basename.toLowerCase();
			const pathLower = file.path.toLowerCase();

			// 1. Basename & path matching (high weight)
			for (const kw of effectiveKeywords) {
				if (nameLower === kw) score += 50;
				else if (nameLower.includes(kw)) score += 25;
				else if (pathLower.includes(kw)) score += 10;
			}

			// 2. Metadata: Tags & Aliases
			const cache = app.metadataCache.getFileCache(file);
			if (cache) {
				const tags = cache.tags?.map((t) => t.tag.toLowerCase()) ?? [];
				for (const tag of tags) {
					for (const kw of effectiveKeywords) {
						if (tag.includes(kw)) score += 15;
					}
				}

				const headings = cache.headings?.map((h) => h.heading.toLowerCase()) ?? [];
				for (const h of headings) {
					for (const kw of effectiveKeywords) {
						if (h.includes(kw)) score += 12;
					}
				}
			}

			if (score > 0) {
				scored.push({ file, score });
			}
		}

		// Sort initial candidates by title/metadata score
		scored.sort((a, b) => b.score - a.score);

		// Now scan top candidates for content matches to refine score and gather snippets
		const candidates = scored.slice(0, Math.max(maxNotes * 3, 12));
		const results: VaultNoteContext[] = [];

		for (const { file, score: initialScore } of candidates) {
			try {
				const content = await app.vault.cachedRead(file);
				const contentLower = content.toLowerCase();
				let contentScore = 0;
				let firstMatchPos = -1;

				for (const kw of effectiveKeywords) {
					let pos = 0;
					let count = 0;
					while ((pos = contentLower.indexOf(kw, pos)) !== -1) {
						if (firstMatchPos === -1) firstMatchPos = pos;
						count++;
						pos += kw.length;
						if (count >= 10) break; // cap frequency
					}
					contentScore += count * 5;
				}

				const totalScore = initialScore + contentScore;
				if (totalScore > 0) {
					let snippet = "";
					if (content.length <= maxChars) {
						snippet = content.trim();
					} else {
						// Extract excerpt around first match
						const start = Math.max(0, (firstMatchPos !== -1 ? firstMatchPos : 0) - 150);
						const end = Math.min(content.length, start + maxChars);
						snippet =
							(start > 0 ? "…\n" : "") +
							content.substring(start, end).trim() +
							(end < content.length ? "\n…" : "");
					}

					results.push({
						file,
						score: totalScore,
						snippet,
						title: file.basename,
						path: file.path,
					});
				}
			} catch {
				// Ignore unreadable files
			}
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, maxNotes);
	}

	public static formatVaultPrompt(
		notes: VaultNoteContext[],
		userQuery: string,
	): string {
		if (!notes.length) return userQuery;

		let prompt = `[Vault Knowledge Base: ${notes.length} note${notes.length > 1 ? "s" : ""} retrieved]\n`;
		prompt += `The following notes from the user's Obsidian vault contain relevant information:\n\n`;

		for (const n of notes) {
			prompt += `--- Note: [[${n.title}]] (${n.path}) ---\n`;
			prompt += `${n.snippet}\n`;
			prompt += `--- End of [[${n.title}]] ---\n\n`;
		}

		prompt += `User Question about Vault:\n${userQuery}`;
		return prompt;
	}
}
