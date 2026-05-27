import { ItemView, Menu, Notice, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import AIChatPlugin from "../main";
import { SERVICE_URLS, ServiceKey } from "../constants";
import { ContextItem } from "../settings";
import { ContextSearchModal } from "../modals/ContextSearchModal";
import { FolderPickerModal } from "../modals/FolderPickerModal";
import { SaveDestinationModal } from "../modals/SaveDestinationModal";
import {
	normalizeUrl,
	getServiceKey,
	firstEnabled,
	buildContextString,
	stripFrontmatterContent,
} from "../utils";

export const AI_CHAT_VIEW_TYPE       = "aibrowser-chat-view";
export const AI_CHAT_SPLIT_VIEW_TYPE = "aibrowser-chat-split-view";

type EmbeddedWebview = HTMLElement & {
	src: string;
	executeJavaScript?: (code: string) => Promise<unknown>;
};

export class AIChatView extends ItemView {
	plugin:    AIChatPlugin;
	isPrimary: boolean;
	pendingText: string | null = null;

	// ── Runtime state ─────────────────────────────────────────
	private activeUrl        = "";
	private items: ContextItem[] = [];
	private isLoading        = true;
	private isAdding         = false;
	private showContextList  = false;

	// ── DOM refs ──────────────────────────────────────────────
	private appEl:        HTMLElement      | null = null;
	private headerEl:     HTMLElement      | null = null;
	private hostEl:       HTMLElement      | null = null;
	private fallbackEl:   HTMLElement      | null = null;
	private svcDotEl:     HTMLElement      | null = null;
	private svcSelectEl:  HTMLSelectElement | null = null;
	private pipEl:        HTMLElement      | null = null;
	private reloadBtnEl:  HTMLButtonElement | null = null;
	private ctxCountEl:   HTMLButtonElement | null = null;
	private addBtnEl:     HTMLButtonElement | null = null;
	private contextListEl: HTMLElement     | null = null;

	// ── Webview ───────────────────────────────────────────────
	private webview:          EmbeddedWebview | null = null;
	private webviewReady      = false;
	private lastInteractedAt  = Date.now();
	private idleTimer:        number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AIChatPlugin, isPrimary = true) {
		super(leaf);
		this.plugin    = plugin;
		this.isPrimary = isPrimary;
	}

	getViewType():    string { return this.isPrimary ? AI_CHAT_VIEW_TYPE : AI_CHAT_SPLIT_VIEW_TYPE; }
	getDisplayText(): string { return this.isPrimary ? "AI Portal" : "AI Portal (2)"; }
	getIcon():        string { return "messages-square"; }

	// ── Lifecycle ─────────────────────────────────────────────

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ai-chat-view");
		this.resolveInitialUrl();
		this.items = [...this.plugin.settings.contextItems];
		this.buildUI();
		this.startIdleTimer();
		if (this.plugin.settings.autoContextOnOpen) this.autoAddActiveFile();
	}

	async onClose(): Promise<void> {
		this.stopIdleTimer();
		this.destroyWebview();
		this.contentEl.empty();
		this.contentEl.removeClass("ai-chat-view");
		this.nullRefs();
	}

	injectText(text: string): void {
		this.pendingText = text;
		if (this.webviewReady) void this.flushPendingText();
	}

	renderView(): void {
		const s   = this.plugin.settings;
		const url = normalizeUrl(this.isPrimary ? s.webAppUrl : s.splitPanelUrl);

		// Auto-switch if the active service was just disabled.
		const key   = getServiceKey(url);
		const flags = this.getEnabledFlags();
		if (key && !flags[key]) {
			const fb = firstEnabled(flags);
			this.activeUrl = fb ? SERVICE_URLS[fb] : url;
		} else {
			this.activeUrl = url;
		}

		// Theme
		if (this.appEl) {
			if (s.theme !== "auto") this.appEl.setAttribute("data-cp-theme", s.theme);
			else                    this.appEl.removeAttribute("data-cp-theme");
		}

		// Update service selector (handles added/removed services)
		this.populateServiceOptions();
		this.updateServiceDot();
		if (this.svcSelectEl) {
			const k = getServiceKey(this.activeUrl);
			this.svcSelectEl.value = k ?? this.activeUrl;
		}

		// Update webview URL if needed — does NOT rebuild the DOM.
		if (this.webview && this.webview.src !== this.activeUrl) {
			this.webviewReady = false;
			this.setLoading(true);
			this.fallbackEl?.hide();
			this.webview.src = this.activeUrl;
		}

		// Restart idle timer so a changed autoRefreshMinutes takes effect immediately.
		this.stopIdleTimer();
		this.startIdleTimer();
	}

	// ── DOM construction ──────────────────────────────────────

	private resolveInitialUrl(): void {
		const s   = this.plugin.settings;
		const url = normalizeUrl(this.isPrimary ? s.webAppUrl : s.splitPanelUrl);
		const key = getServiceKey(url);
		const flags = this.getEnabledFlags();
		if (key && !flags[key]) {
			const fb = firstEnabled(flags);
			this.activeUrl = fb ? SERVICE_URLS[fb] : url;
		} else {
			this.activeUrl = url;
		}
	}

	private buildUI(): void {
		this.contentEl.empty();
		const s    = this.plugin.settings;
		const root = this.contentEl.createDiv({ cls: "ai-chat-root" });

		this.appEl = root.createDiv({ cls: "ai-chat-app" });
		if (s.theme !== "auto") this.appEl.setAttribute("data-cp-theme", s.theme);

		this.headerEl = this.appEl.createEl("header", { cls: "vc-header" });

		const flags       = this.getEnabledFlags();
		const hasServices = Object.values(flags).some(Boolean) || s.customServices.length > 0;
		if (hasServices) this.buildServiceRow();
		this.buildContextBar();

		const shell = this.appEl.createEl("section", { cls: "ai-chat-browser-shell" });
		shell.setAttribute("aria-label", "Embedded AI browser");
		const frame   = shell.createDiv({ cls: "ai-chat-browser-frame" });
		this.hostEl   = frame.createDiv({ cls: "ai-chat-browser-host" });

		this.fallbackEl = frame.createDiv({ cls: "ai-chat-browser-fallback" });
		this.fallbackEl.setAttribute("role", "alert");
		this.fallbackEl.createEl("p", { text: "Could not load the AI service." });
		this.fallbackEl.createEl("p", { text: "Check your connection and ensure Obsidian's web viewer is enabled." });
		this.fallbackEl.hide();

		this.mountWebview();
	}

	private buildServiceRow(): void {
		const row = this.headerEl!.createDiv({ cls: "vc-service-row" });

		this.svcDotEl = row.createSpan({ cls: "vc-svc-dot" });
		this.svcDotEl.setAttribute("aria-hidden", "true");
		this.updateServiceDot();

		const wrap = row.createDiv({ cls: "vc-select-wrap" });
		this.svcSelectEl = wrap.createEl("select", { cls: "vc-service-select" });
		this.svcSelectEl.setAttribute("aria-label", "Select AI service");
		this.populateServiceOptions();
		const k = getServiceKey(this.activeUrl);
		this.svcSelectEl.value = k ?? this.activeUrl;
		this.svcSelectEl.addEventListener("change", (e) => {
			const val = (e.target as HTMLSelectElement).value;
			if (val in SERVICE_URLS) this.switchService(val as ServiceKey);
			else if (val) this.switchToUrl(val);
		});
		wrap.createSpan({ cls: "vc-select-caret" }).setAttribute("aria-hidden", "true");

		this.pipEl = row.createSpan({ cls: "vc-loading-pip" });
		this.pipEl.setAttribute("aria-label", "Loading");
		this.pipEl.hide();

		this.reloadBtnEl = row.createEl("button", { cls: "vc-reload-btn", text: "↺" });
		this.reloadBtnEl.title = "Reload the AI page";
		this.reloadBtnEl.setAttribute("aria-label", "Reload");
		this.reloadBtnEl.addEventListener("click", () => this.reloadWebview());
	}

	private populateServiceOptions(): void {
		if (!this.svcSelectEl) return;
		this.svcSelectEl.empty();
		const s = this.plugin.settings;
		const opt = (val: string, label: string): void => {
			const o = this.svcSelectEl!.createEl("option", { text: label });
			o.value = val;
		};
		if (s.enableChatGPT)    opt("chatgpt",    "ChatGPT");
		if (s.enableClaude)     opt("claude",     "Claude");
		if (s.enableDeepSeek)   opt("deepseek",   "DeepSeek");
		if (s.enablePerplexity) opt("perplexity", "Perplexity");
		if (s.enableGemini)     opt("gemini",     "Gemini");
		if (s.enableGrok)       opt("grok",       "Grok");
		if (s.enableCopilot)    opt("copilot",    "Copilot");
		if (s.enableManus)      opt("manus",      "Manus AI");
		if (s.enableKimi)       opt("kimi",       "Kimi");
		for (const svc of s.customServices) opt(svc.url, svc.label);
	}

	private buildContextBar(): void {
		const s   = this.plugin.settings;
		const bar = this.headerEl!.createDiv({ cls: "vc-context-bar" });

		// ── Left: action buttons ───────────────────────────────
		const actions = bar.createDiv({ cls: "vc-ctx-actions" });

		const ctxBtn = actions.createEl("button", { cls: "vc-ctx-btn", text: "+ note ▾" });
		ctxBtn.title = "Add notes or folders to context";
		ctxBtn.addEventListener("click", (e: MouseEvent) => {
			const menu = new Menu();
			menu.addItem(i => i.setTitle("Active note").setIcon("file").onClick(() => this.addActiveFile()));
			menu.addItem(i => i.setTitle("Open tabs").setIcon("files").onClick(() => this.addAllOpenFiles()));
			menu.addSeparator();
			menu.addItem(i => i.setTitle("Pick note…").setIcon("file-search").onClick(() => this.addFile()));
			menu.addItem(i => i.setTitle("Pick folder…").setIcon("folder-open").onClick(() => this.addFolder()));
			menu.showAtMouseEvent(e);
		});

		if (s.promptTemplates.length > 0) {
			const wrap = actions.createDiv({ cls: "vc-select-wrap vc-templates-wrap" });
			const sel  = wrap.createEl("select", { cls: "vc-templates-select" });
			sel.setAttribute("aria-label", "Insert a prompt template");
			const ph = sel.createEl("option", { text: "Templates…" });
			ph.value = ""; ph.disabled = true;
			for (const t of s.promptTemplates) {
				const o = sel.createEl("option", { text: t.label });
				o.value = t.id;
			}
			sel.value = "";
			sel.addEventListener("change", () => {
				const tmpl = s.promptTemplates.find(t => t.id === sel.value);
				if (tmpl) void this.applyTemplate(tmpl.text);
				sel.value = "";
			});
			wrap.createSpan({ cls: "vc-select-caret" }).setAttribute("aria-hidden", "true");
		}

		// ── Right: context count + send + save ─────────────────
		const right = bar.createDiv({ cls: "vc-ctx-right" });

		this.ctxCountEl = right.createEl("button", { cls: "vc-ctx-count" });
		this.ctxCountEl.setAttribute("aria-expanded", "false");
		this.ctxCountEl.addEventListener("click", () => this.toggleContextList());

		this.addBtnEl = right.createEl("button", { cls: "vc-add-btn", text: "Add" });
		this.addBtnEl.title = "Paste note content into chat";
		this.addBtnEl.addEventListener("click", () => void this.handleAddContext());

		const saveBtn = right.createEl("button", { cls: "vc-save-btn", text: "Save ▾" });
		saveBtn.title = "Save AI response to your vault";
		saveBtn.setAttribute("aria-label", "Save AI response");
		saveBtn.addEventListener("click", (e: MouseEvent) => {
			const menu = new Menu();
			menu.addItem(i => i.setTitle("Save selection").setIcon("text-select").onClick(() => void this.saveWebviewSelection()));
			menu.addItem(i => i.setTitle("Save clipboard").setIcon("clipboard").onClick(() => void this.saveFromClipboard()));
			menu.showAtMouseEvent(e);
		});

		this.updateContextCount();
	}

	private nullRefs(): void {
		this.appEl = null; this.headerEl = null; this.hostEl = null;
		this.fallbackEl = null; this.svcDotEl = null; this.svcSelectEl = null;
		this.pipEl = null; this.reloadBtnEl = null;
		this.ctxCountEl = null; this.addBtnEl = null; this.contextListEl = null;
	}

	// ── Webview ───────────────────────────────────────────────

	private mountWebview(): void {
		if (!this.hostEl || this.webview) return;

		// eslint-disable-next-line obsidianmd/prefer-active-doc -- webview must use document.createElement
		const wv = document.createElement("webview") as EmbeddedWebview;
		wv.className = "ai-chat-browser-webview";
		wv.setAttribute("partition",      "persist:aibrowser-chat");
		wv.setAttribute("allowpopups",    "");
		wv.setAttribute("webpreferences", "contextIsolation=yes");
		wv.setAttribute("useragent",      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
		wv.src = this.activeUrl;

		wv.addEventListener("dom-ready", () => {
			this.webviewReady = true;
			this.setLoading(false);
			this.lastInteractedAt = Date.now();
			if (this.pendingText) void this.flushPendingText();
		});
		wv.addEventListener("did-start-loading",    () => this.setLoading(true));
		wv.addEventListener("did-stop-loading",     () => { this.setLoading(false); this.lastInteractedAt = Date.now(); });
		wv.addEventListener("did-fail-load",        () => { this.setLoading(false); this.fallbackEl?.show(); });
		wv.addEventListener("did-navigate",         () => { this.lastInteractedAt = Date.now(); });
		wv.addEventListener("did-navigate-in-page", () => { this.lastInteractedAt = Date.now(); });

		this.hostEl.appendChild(wv);
		this.webview = wv;
	}

	private destroyWebview(): void {
		this.webview?.remove();
		this.webview      = null;
		this.webviewReady = false;
	}

	// ── Idle timer ────────────────────────────────────────────

	private startIdleTimer(): void {
		const mins = this.plugin.settings.autoRefreshMinutes;
		if (mins <= 0) return;
		const ms = mins * 60_000;
		this.idleTimer = window.setInterval(() => {
			if (Date.now() - this.lastInteractedAt >= ms && this.webviewReady && this.webview) {
				this.webviewReady = false;
				this.setLoading(true);
				const src = this.webview.src;
				this.webview.src = src;
				this.lastInteractedAt = Date.now();
			}
		}, 60_000);
	}

	private stopIdleTimer(): void {
		if (this.idleTimer !== null) { window.clearInterval(this.idleTimer); this.idleTimer = null; }
	}

	// ── Targeted DOM updates ──────────────────────────────────

	private setLoading(on: boolean): void {
		this.isLoading = on;
		if (on) { this.pipEl?.show(); this.reloadBtnEl?.hide(); this.fallbackEl?.hide(); }
		else    { this.pipEl?.hide(); this.reloadBtnEl?.show(); }
	}

	private updateServiceDot(): void {
		if (!this.svcDotEl) return;
		for (const c of Array.from(this.svcDotEl.classList)) {
			if (c.startsWith("vc-svc-dot--")) this.svcDotEl.removeClass(c);
		}
		this.svcDotEl.addClass(`vc-svc-dot--${getServiceKey(this.activeUrl) ?? "none"}`);
	}

	private updateContextCount(): void {
		const n   = this.items.length;
		const has = n > 0;
		if (this.ctxCountEl) {
			this.ctxCountEl.setText(has ? `${n} ${n === 1 ? "item" : "items"} ▾` : "–");
			this.ctxCountEl.title = has ? `${n} item${n !== 1 ? "s" : ""} — click to view` : "No items in context";
			if (has) this.ctxCountEl.addClass("has-items");
			else     this.ctxCountEl.removeClass("has-items");
			this.ctxCountEl.disabled = !has;
		}
		if (this.addBtnEl) {
			this.addBtnEl.disabled = !has || this.isAdding;
			this.addBtnEl.setText(this.isAdding ? "…" : "Add");
			if (has) this.addBtnEl.addClass("is-ready");
			else     this.addBtnEl.removeClass("is-ready");
		}
	}

	private toggleContextList(): void {
		this.showContextList = !this.showContextList;
		this.ctxCountEl?.setAttribute("aria-expanded", String(this.showContextList));
		if (this.showContextList) this.ctxCountEl?.addClass("is-open");
		else                      this.ctxCountEl?.removeClass("is-open");
		if (this.showContextList) this.renderContextList();
		else { this.contextListEl?.remove(); this.contextListEl = null; }
	}

	private renderContextList(): void {
		this.contextListEl?.remove();
		this.contextListEl = null;
		if (!this.showContextList || !this.items.length) return;

		const list = this.headerEl!.createDiv({ cls: "vc-context-list" });
		list.setAttribute("role", "list");
		list.setAttribute("aria-label", "Context items");

		for (const item of this.items) {
			const row  = list.createDiv({ cls: "vc-ctx-item" });
			row.setAttribute("role", "listitem");
			const badge = row.createSpan({ cls: `vc-item-badge vc-item-badge--${item.type}`, text: item.type === "file" ? "F" : "D" });
			badge.setAttribute("aria-hidden", "true");
			const name = row.createSpan({ cls: "vc-item-name", text: item.displayName });
			name.title = item.path;
			const rm = row.createEl("button", { cls: "vc-item-remove", text: "×" });
			rm.setAttribute("aria-label", `Remove ${item.displayName} from context`);
			rm.addEventListener("click", () => this.removeItem(item.path));
		}

		const footer = list.createDiv({ cls: "vc-ctx-list-footer" });
		footer.createEl("button", { cls: "vc-ctx-clear-btn", text: "Clear all" })
			.addEventListener("click", () => this.clearAll());

		this.contextListEl = list;
	}

	// ── Context actions ───────────────────────────────────────

	private autoAddActiveFile(): void {
		const f = this.app.workspace.getActiveFile();
		if (f && !this.items.some(i => i.path === f.path)) {
			this.items.push({ path: f.path, type: "file", displayName: f.basename });
			this.updateContextCount();
		}
	}

	private addActiveFile(): void {
		const f = this.app.workspace.getActiveFile();
		if (!f) { new Notice("No active file."); return; }
		if (this.items.some(i => i.path === f.path)) { new Notice("Already in context."); return; }
		this.items.push({ path: f.path, type: "file", displayName: f.basename });
		this.openContextList();
		void this.plugin.setContextItems(this.items);
	}

	private addAllOpenFiles(): void {
		const open = this.app.workspace
			.getLeavesOfType("markdown")
			.map(l => (l.view as unknown as { file?: TFile }).file)
			.filter((f): f is TFile => f instanceof TFile);
		if (!open.length) { new Notice("No open Markdown files."); return; }
		let added = 0;
		for (const f of open) {
			if (!this.items.some(i => i.path === f.path)) {
				this.items.push({ path: f.path, type: "file", displayName: f.basename });
				added++;
			}
		}
		if (added > 0) {
			new Notice(`Added ${added} file${added !== 1 ? "s" : ""} to context.`);
			this.openContextList();
			void this.plugin.setContextItems(this.items);
		} else {
			new Notice("All open files already in context.");
		}
	}

	private addFile(): void {
		new ContextSearchModal(this.app, (f: TFile) => {
			if (this.items.some(i => i.path === f.path)) return;
			this.items.push({ path: f.path, type: "file", displayName: f.basename });
			this.openContextList();
			void this.plugin.setContextItems(this.items);
		}).open();
	}

	private addFolder(): void {
		new FolderPickerModal(this.app, (folder: TFolder) => {
			if (this.items.some(i => i.path === folder.path)) return;
			const displayName = folder.isRoot() ? "Vault root" : folder.name;
			this.items.push({ path: folder.path, type: "folder", displayName });
			this.openContextList();
			void this.plugin.setContextItems(this.items);
		}).open();
	}

	private removeItem(path: string): void {
		this.items = this.items.filter(i => i.path !== path);
		if (!this.items.length) this.showContextList = false;
		this.updateContextCount();
		this.renderContextList();
		void this.plugin.setContextItems(this.items);
	}

	private clearAll(): void {
		this.items          = [];
		this.showContextList = false;
		this.ctxCountEl?.removeClass("is-open");
		this.ctxCountEl?.setAttribute("aria-expanded", "false");
		this.contextListEl?.remove();
		this.contextListEl = null;
		this.updateContextCount();
		void this.plugin.setContextItems(this.items);
	}

	private openContextList(): void {
		this.showContextList = true;
		this.ctxCountEl?.addClass("is-open");
		this.ctxCountEl?.setAttribute("aria-expanded", "true");
		this.updateContextCount();
		this.renderContextList();
	}

	private async applyTemplate(text: string): Promise<void> {
		if (!text.trim()) { new Notice("This template is empty — edit it in settings."); return; }
		if (!await this.injectIntoWebview(text)) {
			await navigator.clipboard.writeText(text);
			new Notice("Template copied — paste with Cmd+V / Ctrl+V.");
		}
	}

	private async handleAddContext(): Promise<void> {
		if (!this.items.length) { new Notice("Add some notes to context first."); return; }
		const s = this.plugin.settings;
		this.isAdding = true;
		this.updateContextCount();
		try {
			const parts: string[] = [];
			for (const item of this.items) {
				const node = this.app.vault.getAbstractFileByPath(item.path);
				if (item.type === "file" && node instanceof TFile) {
					const raw = await this.app.vault.read(node);
					parts.push(`## Note: ${node.basename}\n\n${s.stripFrontmatter ? stripFrontmatterContent(raw) : raw}`);
				} else if (item.type === "folder" && node instanceof TFolder) {
					const files: TFile[] = [];
					const walk = (f: TFolder): void => {
						for (const c of f.children) {
							if (c instanceof TFile && c.extension === "md") files.push(c);
							else if (c instanceof TFolder) walk(c);
						}
					};
					walk(node);
					for (const file of files) {
						const raw = await this.app.vault.read(file);
						parts.push(`## Note: ${file.basename}\n\n${s.stripFrontmatter ? stripFrontmatterContent(raw) : raw}`);
					}
				}
			}
			if (!parts.length) { new Notice("No readable notes found."); return; }
			const { text, truncated } = buildContextString(parts, s.maxContextLength, s.contextPrefix);
			if (truncated) new Notice("Context truncated — limit reached.");
			if (await this.injectIntoWebview(text)) {
				new Notice("Context pasted in chat.");
			} else {
				await navigator.clipboard.writeText(text);
				new Notice("Context copied — paste with Cmd+V / Ctrl+V.");
			}
			if (s.autoClearContext) this.clearAll();
		} finally {
			this.isAdding = false;
			this.updateContextCount();
		}
	}

	// ── Save actions ──────────────────────────────────────────

	private async saveFromClipboard(): Promise<void> {
		const text = await navigator.clipboard.readText();
		if (!text.trim()) { new Notice("Clipboard is empty — copy an AI response first."); return; }
		new SaveDestinationModal(this.app, text, this.plugin.settings.saveNoteFolder).open();
	}

	private async saveWebviewSelection(): Promise<void> {
		if (!this.webview?.executeJavaScript) { new Notice("Cannot access page content."); return; }
		let text: string;
		try { text = await this.webview.executeJavaScript("window.getSelection()?.toString() ?? ''") as string; }
		catch { new Notice("Could not read selection from page."); return; }
		if (!text.trim()) { new Notice("Select some text in the AI response first."); return; }
		new SaveDestinationModal(this.app, text, this.plugin.settings.saveNoteFolder).open();
	}

	// ── Navigation ────────────────────────────────────────────

	private sanitizeWebviewUrl(url: string): string | null {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
			return parsed.href;
		} catch {
			return null;
		}
	}

	private switchToUrl(url: string): void {
		const safeUrl = this.sanitizeWebviewUrl(url);
		if (!safeUrl) {
			console.warn("Invalid URL attempted:", url);
			return;
		}
		this.activeUrl = safeUrl;
		if (this.isPrimary) void this.plugin.setWebAppUrl(safeUrl);
		else                void this.plugin.setSplitPanelUrl(safeUrl);
		this.updateServiceDot();
		if (this.webview && this.webview.src !== safeUrl) {
			this.webviewReady = false;
			this.setLoading(true);
			this.fallbackEl?.hide();
			this.webview.src = safeUrl;
		}
	}

	private switchService(key: ServiceKey): void { this.switchToUrl(SERVICE_URLS[key]); }

	private reloadWebview(): void {
		if (!this.webview) return;
		this.webviewReady = false;
		this.setLoading(true);
		const src = this.webview.src;
		this.webview.src = src;
		this.lastInteractedAt = Date.now();
	}

	// ── Text injection ────────────────────────────────────────

	private async flushPendingText(): Promise<void> {
		if (!this.pendingText) return;
		const text    = this.pendingText;
		this.pendingText = null;
		if (await this.injectIntoWebview(text)) {
			new Notice("Selection sent to AI.");
		} else {
			await navigator.clipboard.writeText(text);
			new Notice("Selection copied — paste with Cmd+V / Ctrl+V.");
		}
	}

	private async injectIntoWebview(text: string): Promise<boolean> {
		if (!this.webview?.executeJavaScript) return false;
		try {
			const json   = JSON.stringify(text);
			const result = await this.webview.executeJavaScript(`
				(function(ctx) {
					var selectors = [
						'#prompt-textarea',
						'[contenteditable="true"][aria-label]',
						'div[contenteditable="true"].ql-editor',
						'textarea',
						'[contenteditable="true"]'
					];
					var el = null;
					for (var i = 0; i < selectors.length; i++) {
						var f = document.querySelector(selectors[i]);
						if (f) { el = f; break; }
					}
					if (!el) return false;
					el.focus();
					if (el.tagName === 'TEXTAREA') {
						var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
						if (desc && desc.set) desc.set.call(el, el.value + ctx);
						else el.value = el.value + ctx;
						el.dispatchEvent(new Event('input',  { bubbles: true }));
						el.dispatchEvent(new Event('change', { bubbles: true }));
						return true;
					}
					var ok = document.execCommand('insertText', false, ctx);
					if (!ok) {
						try {
							var dt = new DataTransfer();
							dt.setData('text/plain', ctx);
							el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
						} catch(e) { return false; }
					}
					el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: ctx }));
					return true;
				})(${json})
			`);
			return result === true;
		} catch { return false; }
	}

	// ── Helpers ───────────────────────────────────────────────

	private getEnabledFlags(): Record<ServiceKey, boolean> {
		const s = this.plugin.settings;
		return {
			chatgpt:    s.enableChatGPT,
			claude:     s.enableClaude,
			deepseek:   s.enableDeepSeek,
			perplexity: s.enablePerplexity,
			gemini:     s.enableGemini,
			grok:       s.enableGrok,
			copilot:    s.enableCopilot,
			manus:      s.enableManus,
			kimi:       s.enableKimi,
		};
	}
}
