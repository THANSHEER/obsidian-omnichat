import { App, SuggestModal, TFile } from "obsidian";

interface SearchResult {
	file: TFile;
	snippet: string | null;
}

export class ContextSearchModal extends SuggestModal<SearchResult> {
	private onSelect: (file: TFile) => void;
	private allFiles: TFile[];
	private contentCache = new Map<string, string>();

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder("Search notes by name or content…");
		this.allFiles = app.vault.getMarkdownFiles().sort((a, b) =>
			a.basename.localeCompare(b.basename),
		);
		void this.preloadContent();
	}

	private async preloadContent(): Promise<void> {
		for (const file of this.allFiles) {
			try {
				this.contentCache.set(file.path, await this.app.vault.cachedRead(file));
			} catch {
				// skip unreadable files
			}
		}
	}

	getSuggestions(query: string): SearchResult[] {
		const q = query.toLowerCase().trim();
		if (!q) {
			return this.allFiles.slice(0, 50).map((file) => ({ file, snippet: null }));
		}

		const nameMatches: SearchResult[]    = [];
		const contentMatches: SearchResult[] = [];

		for (const file of this.allFiles) {
			const pathLower    = file.path.toLowerCase();
			const content      = this.contentCache.get(file.path) ?? "";
			const contentLower = content.toLowerCase();

			if (pathLower.includes(q)) {
				nameMatches.push({ file, snippet: null });
				continue;
			}

			if (contentLower.includes(q)) {
				const idx     = contentLower.indexOf(q);
				const start   = Math.max(0, idx - 40);
				const end     = Math.min(content.length, idx + q.length + 60);
				const raw     = content.slice(start, end).replace(/\n+/g, " ").trim();
				const snippet = (start > 0 ? "…" : "") + raw + (end < content.length ? "…" : "");
				contentMatches.push({ file, snippet });
			}
		}

		return [...nameMatches, ...contentMatches].slice(0, 50);
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
