import { App, SuggestModal, TFile } from "obsidian";

interface SearchResult {
	file: TFile;
	snippet: string | null;
}

interface FileEntry {
	file: TFile;
	pathLower: string;
	content: string;       // original text, kept for snippet slicing
	contentLower: string;  // lowercased once, reused on every keystroke
}

export class ContextSearchModal extends SuggestModal<SearchResult> {
	private onSelect: (file: TFile) => void;
	private entries: FileEntry[];
	private static readonly MAX_RESULTS = 50;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder("Search notes by name or content…");
		// Build the name index synchronously; content is filled in lazily below.
		this.entries = app.vault.getMarkdownFiles()
			.sort((a, b) => a.basename.localeCompare(b.basename))
			.map(file => ({ file, pathLower: file.path.toLowerCase(), content: "", contentLower: "" }));
		void this.preloadContent();
	}

	// Name search works immediately; content matches light up as files finish loading.
	private async preloadContent(): Promise<void> {
		for (const entry of this.entries) {
			try {
				const content      = await this.app.vault.cachedRead(entry.file);
				entry.content      = content;
				entry.contentLower = content.toLowerCase();
			} catch {
				// skip unreadable files
			}
		}
	}

	getSuggestions(query: string): SearchResult[] {
		const max = ContextSearchModal.MAX_RESULTS;
		const q   = query.toLowerCase().trim();
		if (!q) {
			return this.entries.slice(0, max).map(e => ({ file: e.file, snippet: null }));
		}

		const scanContent = q.length >= 2;  // skip the full-text scan for single chars
		const nameMatches: SearchResult[]    = [];
		const contentMatches: SearchResult[] = [];

		for (const e of this.entries) {
			if (e.pathLower.includes(q)) {
				nameMatches.push({ file: e.file, snippet: null });
			} else if (scanContent) {
				const idx = e.contentLower.indexOf(q);
				if (idx !== -1) {
					const start   = Math.max(0, idx - 40);
					const end     = Math.min(e.content.length, idx + q.length + 60);
					const raw     = e.content.slice(start, end).replace(/\n+/g, " ").trim();
					const snippet = (start > 0 ? "…" : "") + raw + (end < e.content.length ? "…" : "");
					contentMatches.push({ file: e.file, snippet });
				}
			}
			// Stop once we have enough to fill the list — no need to scan the whole vault.
			if (nameMatches.length + contentMatches.length >= max) break;
		}

		return [...nameMatches, ...contentMatches].slice(0, max);
	}

	renderSuggestion(result: SearchResult, el: HTMLElement): void {
		el.createEl("div", { text: result.file.path, cls: "ctx-search-path" });
		if (result.snippet) {
			el.createEl("div", { text: result.snippet, cls: "ctx-search-snippet" });
		}
	}

	onChooseSuggestion(result: SearchResult): void {
		this.onSelect(result.file);
	}
}
