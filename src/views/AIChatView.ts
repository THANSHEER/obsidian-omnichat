import { App, ItemView, Menu, Modal, Notice, setIcon, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import AIChatPlugin from "../main";
import { SERVICE_META, SERVICE_URLS, ServiceKey } from "../constants";
import { ContextItem } from "../settings";
import { ContextSearchModal } from "../modals/ContextSearchModal";
import { FolderPickerModal } from "../modals/FolderPickerModal";
import { SaveDestinationModal } from "../modals/SaveDestinationModal";
import { OAuthLoginModal } from "../modals/OAuthLoginModal";
import { AgentChatUI } from "./AgentChatUI";
import { AGENT_ENGINES, type AgentEngineKey, type UIMode } from "../types/agent";
import {
	buildClearWebviewThemeScript,
	buildWebviewThemeScript,
	getObsidianThemeTokens,
} from "../services/WebviewThemeService";
import {
	normalizeUrl,
	getServiceKey,
	firstEnabled,
	buildContextString,
	stripFrontmatterContent,
	getCleanUserAgent,
	getChromeStealthScript,
	getWebviewScrollFixScript,
	isAuthUrl,
} from "../utils";

export const AI_CHAT_VIEW_TYPE       = "aibrowser-chat-view";
export const AI_CHAT_SPLIT_VIEW_TYPE = "aibrowser-chat-split-view";

class ConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly message: string,
		private readonly onConfirm: () => void,
	) { super(app); }

	onOpen(): void {
		this.contentEl.createEl("p", { text: this.message });
		const btns = this.contentEl.createDiv({ cls: "modal-button-container" });
		btns.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
		const ok = btns.createEl("button", { text: "Clear all", cls: "mod-warning" });
		ok.addEventListener("click", () => { this.close(); this.onConfirm(); });
	}

	onClose(): void { this.contentEl.empty(); }
}

type EmbeddedWebview = HTMLElement & {
	src: string;
	executeJavaScript?: (code: string) => Promise<unknown>;
	canGoBack?: () => boolean;
	canGoForward?: () => boolean;
	goBack?: () => void;
	goForward?: () => void;
	getURL?: () => string;
};

export class AIChatView extends ItemView {
	plugin:    AIChatPlugin;
	isPrimary: boolean;
	private pendingText: string | null = null;

	// ── Runtime state ─────────────────────────────────────────
	public currentMode:       UIMode = "browser";
	private activeUrl        = "";
	private items: ContextItem[] = [];
	private isAdding         = false;
	private showContextList  = false;

	// ── DOM refs ──────────────────────────────────────────────
	private appEl:        HTMLElement      | null = null;
	private headerEl:     HTMLElement      | null = null;
	private hostEl:       HTMLElement      | null = null;
	private fallbackEl:   HTMLElement      | null = null;
	private browserShellEl: HTMLElement    | null = null;
	private nativeUiShellEl: HTMLElement   | null = null;
	private agentChat:    AgentChatUI      | null = null;
	private browserModeBtnEl: HTMLButtonElement | null = null;
	private agentModeBtnEl:   HTMLButtonElement | null = null;
	private svcSelectWrapEl:  HTMLElement   | null = null;
	private loadingEl:      HTMLElement    | null = null;
	private loadingLabelEl: HTMLElement    | null = null;
	private svcDotEl:     HTMLElement      | null = null;
	private svcSelectEl:  HTMLSelectElement | null = null;
	private pipEl:        HTMLElement      | null = null;
	private backBtnEl:    HTMLButtonElement | null = null;
	private forwardBtnEl: HTMLButtonElement | null = null;
	private openExternalBtnEl: HTMLButtonElement | null = null;
	private reloadBtnEl:   HTMLButtonElement | null = null;
	private ctxCountEl:    HTMLButtonElement | null = null;
	private addBtnEl:      HTMLButtonElement | null = null;
	private copyCtxBtnEl:  HTMLButtonElement | null = null;
	private templatesSelectEl: HTMLSelectElement | null = null;
	private contextListEl: HTMLElement      | null = null;
	/** Cache so populateServiceOptions skips rebuild when unchanged. */
	private serviceOptionsSig = "";
	/** Cache so populateTemplateOptions skips rebuild when unchanged. */
	private templateOptionsSig = "";

	// ── Webview ───────────────────────────────────────────────
	private webview:          EmbeddedWebview | null = null;
	private webviewReady      = false;
	private lastInteractedAt  = Date.now();
	private idleTimer:        number | null = null;
	/**
	 * Watchdog for a page that starts loading but never reports back (network stall,
	 * proxy interference, or a hung webview renderer). Without it the spinner stays
	 * on screen forever and the whole app looks frozen.
	 */
	private loadTimer:        number | null = null;
	private fallbackMsgEl:    HTMLElement | null = null;
	private fallbackRetryEl:  HTMLButtonElement | null = null;

	/** How long a single page load may stay pending before the failure state is shown. */
	private static readonly LOAD_TIMEOUT_MS = 25_000;

	constructor(leaf: WorkspaceLeaf, plugin: AIChatPlugin, isPrimary = true) {
		super(leaf);
		this.plugin    = plugin;
		this.isPrimary = isPrimary;
	}

	getViewType():    string { return this.isPrimary ? AI_CHAT_VIEW_TYPE : AI_CHAT_SPLIT_VIEW_TYPE; }
	getDisplayText(): string { return this.isPrimary ? "OmniChat" : "OmniChat (2)"; }
	getIcon():        string { return "messages-square"; }

	// ── Lifecycle ─────────────────────────────────────────────

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ai-chat-view");
		this.currentMode = this.isPrimary
			? this.plugin.settings.defaultMode
			: this.plugin.settings.splitPanelMode;
		this.resolveInitialUrl();
		this.items = [...this.plugin.settings.contextItems];
		this.buildUI();
		this.startIdleTimer();
		// Guaranteed cleanup on unload, even if onClose is bypassed (stopIdleTimer is idempotent).
		this.register(() => this.stopIdleTimer());
		this.registerEvent(this.app.workspace.on("css-change", () => this.applyWebviewTheme()));
		if (this.plugin.settings.autoContextOnOpen) this.autoAddActiveFile();
	}

	async onClose(): Promise<void> {
		this.stopIdleTimer();
		this.clearLoadWatchdog();
		this.destroyWebview();
		this.agentChat?.destroy();
		this.agentChat = null;
		this.contentEl.empty();
		this.contentEl.removeClass("ai-chat-view");
		this.nullRefs();
	}

	injectText(text: string): void {
		if (this.currentMode === "agent") {
			this.agentChat?.injectContext(text);
			return;
		}
		this.pendingText = text;
		if (this.webviewReady) void this.flushPendingText();
	}

	public setMode(mode: UIMode): void {
		if (this.currentMode === mode) return;
		this.currentMode = mode;
		this.applyModeUI();
	}

	public applyModeUI(): void {
		if (this.browserModeBtnEl) {
			if (this.currentMode === "browser") this.browserModeBtnEl.addClass("is-active");
			else this.browserModeBtnEl.removeClass("is-active");
		}
		if (this.agentModeBtnEl) {
			if (this.currentMode === "agent") this.agentModeBtnEl.addClass("is-active");
			else this.agentModeBtnEl.removeClass("is-active");
		}

		this.svcSelectWrapEl?.show();
		this.reloadBtnEl?.show();
		this.svcDotEl?.show();

		if (this.currentMode === "agent") {
			this.browserShellEl?.hide();
			this.nativeUiShellEl?.show();
			this.pipEl?.hide();
			this.backBtnEl?.hide();
			this.forwardBtnEl?.hide();
			this.openExternalBtnEl?.hide();
			this.setLoading(false);
			this.syncSelectValue();
			this.updateServiceDot();
			this.agentChat?.reload();
		} else {
			const isOllama = getServiceKey(this.activeUrl) === "ollama";
			if (isOllama) {
				this.browserShellEl?.hide();
				this.nativeUiShellEl?.show();
				this.backBtnEl?.hide();
				this.forwardBtnEl?.hide();
				this.openExternalBtnEl?.hide();
				this.setLoading(false);
				this.agentChat?.setEngine("ollama");
			} else {
				this.nativeUiShellEl?.hide();
				this.browserShellEl?.show();
				this.backBtnEl?.show();
				this.forwardBtnEl?.show();
				this.openExternalBtnEl?.show();
				this.updateNavButtons();
				if (this.webview && this.webview.src !== this.activeUrl) {
					this.webviewReady = false;
					this.setLoading(true);
					this.fallbackEl?.hide();
					this.webview.src = this.activeUrl;
				}
			}
			this.syncSelectValue();
			this.updateServiceDot();
		}
	}

	renderView(): void {
		this.refreshContextFromSettings();
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

		// Update service / template selectors only when their option sets change.
		this.populateServiceOptions();
		this.populateTemplateOptions();
		this.syncSelectValue();
		this.updateServiceDot();

		this.applyModeUI();
		this.applyWebviewTheme();

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

		this.browserShellEl = this.appEl.createEl("section", { cls: "ai-chat-browser-shell" });
		this.browserShellEl.setAttribute("aria-label", "Embedded AI browser");
		const frame   = this.browserShellEl.createDiv({ cls: "ai-chat-browser-frame" });
		this.hostEl   = frame.createDiv({ cls: "ai-chat-browser-host" });

		this.nativeUiShellEl = this.appEl.createEl("section", { cls: "ai-chat-native-shell" });
		this.nativeUiShellEl.hide();
		this.agentChat = new AgentChatUI(this.nativeUiShellEl, this.plugin);

		this.fallbackEl = frame.createDiv({ cls: "ai-chat-browser-fallback" });
		this.fallbackEl.setAttribute("role", "alert");
		this.fallbackMsgEl = this.fallbackEl.createEl("p", { text: "Could not load the AI service." });
		this.fallbackEl.createEl("p", { text: "Check your connection and ensure Obsidian's web viewer is enabled." });
		this.fallbackRetryEl = this.fallbackEl.createEl("button", { cls: "mod-cta", text: "Reload" });
		this.fallbackRetryEl.setAttribute("aria-label", "Reload the AI service");
		this.fallbackRetryEl.addEventListener("click", () => this.reloadWebview());
		this.fallbackEl.hide();

		this.loadingEl = frame.createDiv({ cls: "ai-chat-browser-loading" });
		this.loadingEl.setAttribute("role", "status");
		this.loadingEl.setAttribute("aria-live", "polite");
		this.loadingEl.createDiv({ cls: "ai-chat-loading-spinner" });
		this.loadingLabelEl = this.loadingEl.createEl("p", { cls: "ai-chat-loading-text" });
		this.loadingEl.hide();

		this.mountWebview();
		this.applyModeUI();
	}

	private buildServiceRow(): void {
		const row = this.headerEl!.createDiv({ cls: "vc-service-row" });

		const modeGroup = row.createDiv({ cls: "vc-mode-toggle-group" });
		this.browserModeBtnEl = modeGroup.createEl("button", {
			cls: `vc-mode-btn ${this.currentMode === "browser" ? "is-active" : ""}`,
		});
		setIcon(this.browserModeBtnEl.createSpan({ cls: "vc-mode-icon" }), "globe");
		this.browserModeBtnEl.createSpan({ text: "Browser" });
		this.browserModeBtnEl.title = "Switch to browser AI mode";
		this.browserModeBtnEl.addEventListener("click", () => this.setMode("browser"));

		this.agentModeBtnEl = modeGroup.createEl("button", {
			cls: `vc-mode-btn ${this.currentMode === "agent" ? "is-active" : ""}`,
		});
		setIcon(this.agentModeBtnEl.createSpan({ cls: "vc-mode-icon" }), "terminal");
		this.agentModeBtnEl.createSpan({ text: "Agent" });
		this.agentModeBtnEl.title = "Switch to agent CLI & API mode";
		this.agentModeBtnEl.addEventListener("click", () => this.setMode("agent"));

		this.svcDotEl = row.createSpan({ cls: "vc-svc-dot" });
		this.svcDotEl.setAttribute("aria-hidden", "true");
		this.updateServiceDot();

		const wrap = row.createDiv({ cls: "vc-select-wrap" });
		this.svcSelectWrapEl = wrap;
		this.svcSelectEl = wrap.createEl("select", { cls: "vc-service-select" });
		this.svcSelectEl.setAttribute("aria-label", "Select AI service or agent");
		this.populateServiceOptions();
		this.svcSelectEl.addEventListener("change", (e) => {
			const val = (e.target as HTMLSelectElement).value;
			if (val.startsWith("agent:")) {
				const engKey = val.slice("agent:".length) as AgentEngineKey;
				this.plugin.settings.agentEngine = engKey;
				void this.plugin.saveSettings();
				this.agentChat?.setEngine(engKey);
				this.setMode("agent");
			} else if (val.startsWith("browser:")) {
				const target = val.slice("browser:".length);
				this.setMode("browser");
				if (target.startsWith("url:")) {
					this.switchToUrl(target.slice("url:".length));
				} else if (target in SERVICE_URLS) {
					this.switchService(target as ServiceKey);
				}
			}
		});
		wrap.createSpan({ cls: "vc-select-caret" }).setAttribute("aria-hidden", "true");

		this.pipEl = row.createSpan({ cls: "vc-loading-pip" });
		this.pipEl.setAttribute("aria-label", "Loading");
		this.pipEl.hide();

		this.backBtnEl = row.createEl("button", { cls: "vc-reload-btn vc-nav-btn" });
		setIcon(this.backBtnEl, "arrow-left");
		this.backBtnEl.title = "Back";
		this.backBtnEl.setAttribute("aria-label", "Back");
		this.backBtnEl.disabled = true;
		this.backBtnEl.addEventListener("click", () => {
			if (this.webview?.canGoBack?.()) this.webview.goBack?.();
		});

		this.forwardBtnEl = row.createEl("button", { cls: "vc-reload-btn vc-nav-btn" });
		setIcon(this.forwardBtnEl, "arrow-right");
		this.forwardBtnEl.title = "Forward";
		this.forwardBtnEl.setAttribute("aria-label", "Forward");
		this.forwardBtnEl.disabled = true;
		this.forwardBtnEl.addEventListener("click", () => {
			if (this.webview?.canGoForward?.()) this.webview.goForward?.();
		});

		this.reloadBtnEl = row.createEl("button", { cls: "vc-reload-btn" });
		setIcon(this.reloadBtnEl, "rotate-cw");
		this.reloadBtnEl.title = "Reload active page or agent connection";
		this.reloadBtnEl.setAttribute("aria-label", "Reload");
		this.reloadBtnEl.addEventListener("click", () => this.reloadWebview());

		this.openExternalBtnEl = row.createEl("button", { cls: "vc-reload-btn vc-nav-btn" });
		setIcon(this.openExternalBtnEl, "external-link");
		this.openExternalBtnEl.title = "Open in default browser";
		this.openExternalBtnEl.setAttribute("aria-label", "Open in default browser");
		this.openExternalBtnEl.addEventListener("click", () => {
			const url = this.webview?.getURL?.() || this.activeUrl;
			if (url) window.open(url);
		});
	}

	private populateServiceOptions(): void {
		if (!this.svcSelectEl) return;
		const s = this.plugin.settings;
		const sig = [
			s.agentEngine,
			...AGENT_ENGINES.map((e) => e.key),
			...SERVICE_META.filter((m) => s[m.enableKey]).map((m) => m.key),
			...s.customServices.map((svc) => `${svc.id}:${svc.label}:${svc.url}`),
		].join("|");
		if (sig === this.serviceOptionsSig && this.svcSelectEl.options.length > 0) {
			this.syncSelectValue();
			return;
		}
		this.serviceOptionsSig = sig;

		this.svcSelectEl.empty();

		// ── Group 1: Coding Agents & APIs ──
		const agentGroup = this.svcSelectEl.createEl("optgroup", { attr: { label: "Coding agents & APIs" } });
		for (const eng of AGENT_ENGINES) {
			const o = agentGroup.createEl("option", { text: `${eng.label} (${eng.badge})` });
			o.value = `agent:${eng.key}`;
		}

		// ── Group 2: Browser AI Services ──
		const browserGroup = this.svcSelectEl.createEl("optgroup", { attr: { label: "Browser AI services" } });
		for (const m of SERVICE_META) {
			if (s[m.enableKey]) {
				const o = browserGroup.createEl("option", { text: m.label });
				o.value = `browser:${m.key}`;
			}
		}
		for (const svc of s.customServices) {
			const o = browserGroup.createEl("option", { text: svc.label });
			o.value = `browser:url:${svc.url}`;
		}

		this.syncSelectValue();
	}

	private syncSelectValue(): void {
		if (!this.svcSelectEl) return;
		if (this.currentMode === "agent") {
			const targetVal = `agent:${this.plugin.settings.agentEngine || "claude-cli"}`;
			if (Array.from(this.svcSelectEl.options).some((o) => o.value === targetVal)) {
				this.svcSelectEl.value = targetVal;
			}
		} else {
			const k = getServiceKey(this.activeUrl);
			const targetVal = k ? `browser:${k}` : `browser:url:${this.activeUrl}`;
			if (Array.from(this.svcSelectEl.options).some((o) => o.value === targetVal)) {
				this.svcSelectEl.value = targetVal;
			}
		}
	}

	private populateTemplateOptions(): void {
		if (!this.templatesSelectEl) return;
		const templates = this.plugin.settings.promptTemplates;
		const sig = templates.map(t => `${t.id}:${t.label}`).join("|");
		if (sig === this.templateOptionsSig && this.templatesSelectEl.options.length > 0) return;
		this.templateOptionsSig = sig;

		this.templatesSelectEl.empty();
		const ph = this.templatesSelectEl.createEl("option", { text: "Templates…" });
		ph.value = "";
		ph.disabled = true;
		for (const t of templates) {
			const o = this.templatesSelectEl.createEl("option", { text: t.label });
			o.value = t.id;
		}
		this.templatesSelectEl.value = "";
	}

	private buildContextBar(): void {
		const s   = this.plugin.settings;
		const bar = this.headerEl!.createDiv({ cls: "vc-context-bar" });

		// ── Left: action buttons ───────────────────────────────
		const actions = bar.createDiv({ cls: "vc-ctx-actions" });

		const ctxBtn = actions.createEl("button", { cls: "vc-ctx-btn", text: "Add context" });
		ctxBtn.title = "Add notes or folders to context";
		ctxBtn.setAttribute("aria-label", "Add notes or folders to context");
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
			this.templatesSelectEl = wrap.createEl("select", { cls: "vc-templates-select" });
			this.templatesSelectEl.setAttribute("aria-label", "Insert a prompt template");
			this.templatesSelectEl.title = "Insert a prompt template into the chat";
			this.populateTemplateOptions();
			this.templatesSelectEl.addEventListener("change", () => {
				const tmpl = this.plugin.settings.promptTemplates.find(t => t.id === this.templatesSelectEl?.value);
				if (tmpl) void this.applyTemplate(tmpl.text);
				if (this.templatesSelectEl) this.templatesSelectEl.value = "";
			});
			wrap.createSpan({ cls: "vc-select-caret" }).setAttribute("aria-hidden", "true");
		}

		// ── Right: context count + send + save ─────────────────
		const right = bar.createDiv({ cls: "vc-ctx-right" });

		this.ctxCountEl = right.createEl("button", { cls: "vc-ctx-count" });
		this.ctxCountEl.setAttribute("aria-expanded", "false");
		this.ctxCountEl.setAttribute("aria-label", "Show context items");
		this.ctxCountEl.addEventListener("click", () => this.toggleContextList());

		this.addBtnEl = right.createEl("button", { cls: "vc-add-btn", text: "Add" });
		this.addBtnEl.title = "Send context into the active AI chat (clipboard fallback if needed)";
		this.addBtnEl.setAttribute("aria-label", "Send context into the active AI chat");
		this.addBtnEl.addEventListener("click", () => void this.handleAddContext());

		this.copyCtxBtnEl = right.createEl("button", { cls: "vc-copy-ctx-btn", text: "Copy" });
		this.copyCtxBtnEl.title = "Copy context to the clipboard";
		this.copyCtxBtnEl.setAttribute("aria-label", "Copy context to the clipboard");
		this.copyCtxBtnEl.addEventListener("click", () => void this.handleCopyContext());

		const saveBtn = right.createEl("button", { cls: "vc-save-btn", text: "Save" });
		saveBtn.title = "Copy AI text first, then save it to your vault";
		saveBtn.setAttribute("aria-label", "Save AI response to vault");
		saveBtn.addEventListener("click", () => void this.saveSelection());

		this.updateContextCount();
	}

	private nullRefs(): void {
		this.appEl = null; this.headerEl = null; this.hostEl = null;
		this.fallbackEl = null; this.loadingEl = null; this.loadingLabelEl = null;
		this.svcDotEl = null; this.svcSelectEl = null;
		this.pipEl = null; this.backBtnEl = null; this.forwardBtnEl = null;
		this.openExternalBtnEl = null; this.reloadBtnEl = null;
		this.ctxCountEl = null; this.addBtnEl = null; this.copyCtxBtnEl = null;
		this.templatesSelectEl = null; this.contextListEl = null;
		this.browserShellEl = null; this.nativeUiShellEl = null; this.agentChat = null;
		this.browserModeBtnEl = null; this.agentModeBtnEl = null; this.svcSelectWrapEl = null;
		this.serviceOptionsSig = "";
		this.templateOptionsSig = "";
	}

	// ── Webview ───────────────────────────────────────────────

	private mountWebview(): void {
		if (!this.hostEl || this.webview) return;

		const wv = this.hostEl.createEl("webview" as keyof HTMLElementTagNameMap) as EmbeddedWebview;
		wv.className = "ai-chat-browser-webview";
		wv.setAttribute("partition",      "persist:aibrowser-chat");
		wv.setAttribute("allowpopups",    "");
		wv.setAttribute("webpreferences", "contextIsolation=yes");
		
		// Use host OS + Chrome version; strip Electron/Obsidian so sites see a normal browser UA
		wv.setAttribute("useragent", getCleanUserAgent(this.plugin.settings.customUserAgent));

		// Listeners are attached *before* assigning src: the initial load starts as soon as
		// `src` is set, and events fired during that first load (did-start-loading,
		// did-fail-load, …) are lost if no handler is registered yet. Losing them left the
		// spinner running forever with no way back.
		wv.addEventListener("mouseenter", () => {
			if (activeDocument.activeElement !== wv) wv.focus();
		});

		wv.addEventListener("dom-ready", () => {
			this.webviewReady = true;
			this.clearLoadWatchdog();
			this.setLoading(false);
			this.fallbackEl?.hide();
			this.lastInteractedAt = Date.now();
			if (wv.executeJavaScript) {
				void wv.executeJavaScript(getChromeStealthScript());
				void wv.executeJavaScript(getWebviewScrollFixScript());
			}
			this.applyWebviewTheme();
			this.updateNavButtons();
			if (this.pendingText) void this.flushPendingText();
		});
		wv.addEventListener("did-start-loading",    () => {
			this.setLoading(true);
			this.armLoadWatchdog();
		});
		wv.addEventListener("did-stop-loading",     () => {
			this.clearLoadWatchdog();
			this.setLoading(false);
			this.lastInteractedAt = Date.now();
			this.updateNavButtons();
		});
		wv.addEventListener("did-fail-load",        (e: Event) => {
			const ev = e as Event & { errorCode?: number; isMainFrame?: boolean };
			if (ev.errorCode === -3) return;       // load aborted (redirect/cancel) — not a real failure
			if (ev.isMainFrame === false) return;  // sub-frame / sub-resource failure — ignore
			this.clearLoadWatchdog();
			this.showLoadFailure(`Could not load ${this.currentServiceLabel()}.`);
		});
		// A crashed or killed webview renderer never fires did-fail-load; without this the
		// panel would sit on the spinner until the user manually reloads the whole view.
		wv.addEventListener("render-process-gone", () => {
			this.clearLoadWatchdog();
			this.webviewReady = false;
			this.showLoadFailure(`${this.currentServiceLabel()} stopped responding.`);
		});
		wv.addEventListener("did-navigate",         () => {
			this.lastInteractedAt = Date.now();
			if (wv.executeJavaScript) void wv.executeJavaScript(getWebviewScrollFixScript());
			this.applyWebviewTheme();
			this.updateNavButtons();
		});
		wv.addEventListener("did-navigate-in-page", () => {
			this.lastInteractedAt = Date.now();
			if (wv.executeJavaScript) void wv.executeJavaScript(getWebviewScrollFixScript());
			this.applyWebviewTheme();
			this.updateNavButtons();
		});
		wv.addEventListener("new-window", (e: Event) => {
			const ev = e as Event & { url?: string };
			if (typeof ev.url !== "string") return;
			// Route OAuth / login popups into a dedicated Auth modal that shares the persistent session partition
			if (isAuthUrl(ev.url)) {
				new OAuthLoginModal(
					this.app,
					ev.url,
					this.activeUrl,
					() => this.reloadWebview(),
					this.plugin.settings.customUserAgent,
				).open();
			} else {
				// Regular external links (like citations) open safely in the user's default system browser.
				window.open(ev.url);
			}
		});

		this.webview = wv;

		// Start the first load only after every listener above is attached.
		wv.src = this.activeUrl;
		this.armLoadWatchdog();
	}

	private destroyWebview(): void {
		this.clearLoadWatchdog();
		this.webview?.remove();
		this.webview      = null;
		this.webviewReady = false;
	}

	// ── Load watchdog ─────────────────────────────────────────

	/** Arms a timer that trips into the failure state if a load never completes. */
	private armLoadWatchdog(): void {
		this.clearLoadWatchdog();
		if (getServiceKey(this.activeUrl) === "ollama") return;
		this.loadTimer = window.setTimeout(() => {
			this.loadTimer = null;
			if (this.webviewReady) return;
			this.showLoadFailure(`${this.currentServiceLabel()} took too long to load.`);
		}, AIChatView.LOAD_TIMEOUT_MS);
	}

	private clearLoadWatchdog(): void {
		if (this.loadTimer !== null) {
			window.clearTimeout(this.loadTimer);
			this.loadTimer = null;
		}
	}

	/** Exits the loading state and shows the fallback panel with a reason + Reload button. */
	private showLoadFailure(message: string): void {
		this.webviewReady = false;
		this.setLoading(false);
		this.fallbackMsgEl?.setText(message);
		this.fallbackEl?.show();
	}

	private applyWebviewTheme(): void {
		if (!this.webview?.executeJavaScript || !this.webviewReady) return;
		if (this.currentMode !== "browser" || getServiceKey(this.activeUrl) === "ollama") return;
		const script = this.plugin.settings.adaptWebviewTheme
			? buildWebviewThemeScript(getObsidianThemeTokens(this.plugin.settings.theme))
			: buildClearWebviewThemeScript();
		void this.webview.executeJavaScript(script);
	}

	private updateNavButtons(): void {
		if (this.backBtnEl) {
			this.backBtnEl.disabled = !(this.webview?.canGoBack?.() ?? false);
		}
		if (this.forwardBtnEl) {
			this.forwardBtnEl.disabled = !(this.webview?.canGoForward?.() ?? false);
		}
	}
	// ── Idle timer ────────────────────────────────────────────

	private startIdleTimer(): void {
		const mins = this.plugin.settings.autoRefreshMinutes;
		if (mins <= 0) return;
		const ms = mins * 60_000;
		this.idleTimer = window.setInterval(() => {
			if (getServiceKey(this.activeUrl) === "ollama") return;
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
		if (getServiceKey(this.activeUrl) === "ollama") {
			this.pipEl?.hide(); this.reloadBtnEl?.show(); this.fallbackEl?.hide();
			this.loadingEl?.hide();
			return;
		}
		if (on) {
			this.pipEl?.show(); this.reloadBtnEl?.hide(); this.fallbackEl?.hide();
			this.loadingLabelEl?.setText(`Loading ${this.currentServiceLabel()}…`);
			this.loadingEl?.show();
		} else {
			this.pipEl?.hide(); this.reloadBtnEl?.show();
			this.loadingEl?.hide();
		}
	}

	private currentServiceLabel(): string {
		const key = getServiceKey(this.activeUrl);
		if (key) return SERVICE_META.find(m => m.key === key)?.label ?? "AI service";
		const custom = this.plugin.settings.customServices.find(c => normalizeUrl(c.url) === this.activeUrl);
		return custom?.label ?? "AI service";
	}

	private updateServiceDot(): void {
		if (!this.svcDotEl) return;
		for (const c of Array.from(this.svcDotEl.classList)) {
			if (c.startsWith("vc-svc-dot--")) this.svcDotEl.removeClass(c);
		}
		if (this.currentMode === "agent") {
			const engine = this.plugin.settings.agentEngine ?? "claude-cli";
			this.svcDotEl.addClass(`vc-svc-dot--${engine}`);
		} else {
			this.svcDotEl.addClass(`vc-svc-dot--${getServiceKey(this.activeUrl) ?? "none"}`);
		}
	}

	private updateContextCount(): void {
		const n   = this.items.length;
		const has = n > 0;

		let charHint = "";
		if (has) {
			let totalBytes = 0;
			for (const item of this.items) {
				if (item.type === "file") {
					const node = this.app.vault.getAbstractFileByPath(item.path);
					if (node instanceof TFile) totalBytes += node.stat.size;
				}
			}
			if (totalBytes > 0) {
				const display = totalBytes >= 1000
					? `~${(totalBytes / 1000).toFixed(1)}k`
					: `${totalBytes}`;
				charHint = ` · ${display} bytes`;
			}
		}

		if (this.ctxCountEl) {
			this.ctxCountEl.setText(has ? `${n} ▾` : "–");
			const sizePart = charHint ? charHint.replace(/^ · /, "") : "";
			this.ctxCountEl.title = has
				? `${n} item${n !== 1 ? "s" : ""} in context${sizePart ? ` (${sizePart})` : ""} — click to view`
				: "No items in context";
			this.ctxCountEl.setAttribute(
				"aria-label",
				has ? `Show ${n} context item${n !== 1 ? "s" : ""}` : "No items in context",
			);
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
		if (this.copyCtxBtnEl) {
			this.copyCtxBtnEl.disabled = !has;
			if (has) this.copyCtxBtnEl.addClass("is-ready");
			else     this.copyCtxBtnEl.removeClass("is-ready");
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
			.addEventListener("click", () => this.confirmClearAll());

		this.contextListEl = list;
	}

	// ── Context actions ───────────────────────────────────────

	// Context items live in plugin settings (the single source of truth). Persist
	// a mutation, then broadcast so any other open panel re-syncs from settings.
	private syncItems(): void {
		void this.plugin.setContextItems([...this.items]);
		this.plugin.rerenderOpenViews();
	}

	// Re-read context items from settings and refresh the count/list. Called at the
	// top of renderView() so a change made in one panel shows up in the other.
	private refreshContextFromSettings(): void {
		this.items = [...this.plugin.settings.contextItems];
		this.updateContextCount();
		if (this.showContextList) this.renderContextList();
	}

	private autoAddActiveFile(): void {
		const f = this.app.workspace.getActiveFile();
		if (f && !this.items.some(i => i.path === f.path)) {
			this.items.push({ path: f.path, type: "file", displayName: f.basename });
			this.syncItems();
		}
	}

	addActiveFile(): void {
		const f = this.app.workspace.getActiveFile();
		if (!f) { new Notice("No active file."); return; }
		if (this.items.some(i => i.path === f.path)) { new Notice("Already in context."); return; }
		this.items.push({ path: f.path, type: "file", displayName: f.basename });
		this.openContextList();
		this.syncItems();
	}

	addFileFromExternal(file: TFile): void {
		if (this.items.some(i => i.path === file.path)) { new Notice(`"${file.basename}" is already in context.`); return; }
		this.items.push({ path: file.path, type: "file", displayName: file.basename });
		this.openContextList();
		this.syncItems();
		new Notice(`Added "${file.basename}" to OmniChat context.`);
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
			this.syncItems();
		} else {
			new Notice("All open files already in context.");
		}
	}

	private addFile(): void {
		new ContextSearchModal(this.app, (f: TFile) => {
			if (this.items.some(i => i.path === f.path)) return;
			this.items.push({ path: f.path, type: "file", displayName: f.basename });
			this.openContextList();
			this.syncItems();
		}).open();
	}

	private addFolder(): void {
		new FolderPickerModal(this.app, (folder: TFolder) => {
			if (this.items.some(i => i.path === folder.path)) return;
			const displayName = folder.isRoot() ? "Vault root" : folder.name;
			this.items.push({ path: folder.path, type: "folder", displayName });
			this.openContextList();
			this.syncItems();
		}).open();
	}

	private removeItem(path: string): void {
		this.items = this.items.filter(i => i.path !== path);
		if (!this.items.length) this.showContextList = false;
		this.updateContextCount();
		this.renderContextList();
		this.syncItems();
	}

	private confirmClearAll(): void {
		if (!this.items.length) return;
		new ConfirmModal(
			this.app,
			`Remove all ${this.items.length} item${this.items.length !== 1 ? "s" : ""} from context?`,
			() => this.clearAll(),
		).open();
	}

	private clearAll(): void {
		this.items          = [];
		this.showContextList = false;
		this.ctxCountEl?.removeClass("is-open");
		this.ctxCountEl?.setAttribute("aria-expanded", "false");
		this.contextListEl?.remove();
		this.contextListEl = null;
		this.updateContextCount();
		this.syncItems();
	}

	private openContextList(): void {
		this.showContextList = true;
		this.ctxCountEl?.addClass("is-open");
		this.ctxCountEl?.setAttribute("aria-expanded", "true");
		this.updateContextCount();
		this.renderContextList();
	}

	private resolveTemplateVariables(text: string): string {
		const file      = this.app.workspace.getActiveFile();
		const title     = file?.basename ?? "";
		const date      = new Date().toISOString().split("T")[0] ?? "";
		const editor    = this.app.workspace.activeEditor?.editor;
		const selection = editor?.getSelection() ?? "";
		const filePath  = file?.path ?? "";
		const cache     = file ? this.app.metadataCache.getFileCache(file) : null;
		const inlineTags = (cache?.tags ?? []).map(t => t.tag);
		const fmTagsRaw  = cache?.frontmatter?.["tags"] as unknown;
		const fmTags: string[] = Array.isArray(fmTagsRaw)
			? (fmTagsRaw as unknown[]).map(t => { const s = String(t); return s.startsWith("#") ? s : `#${s}`; })
			: typeof fmTagsRaw === "string"
				? [fmTagsRaw.startsWith("#") ? fmTagsRaw : `#${fmTagsRaw}`]
				: [];
		const tags = [...new Set([...inlineTags, ...fmTags])].join(", ");
		return text
			.replace(/\{\{title\}\}/g,     title)
			.replace(/\{\{date\}\}/g,      date)
			.replace(/\{\{selection\}\}/g, selection)
			.replace(/\{\{path\}\}/g,      filePath)
			.replace(/\{\{tags\}\}/g,      tags);
	}

	private async applyTemplate(text: string): Promise<void> {
		if (!text.trim()) { new Notice("This template is empty — edit it in settings."); return; }
		const resolved = this.resolveTemplateVariables(text);
		if (this.currentMode === "agent") {
			this.agentChat?.injectContext(resolved);
			return;
		}
		if (!await this.injectIntoWebview(resolved)) {
			try {
				// Clipboard write is a user-initiated fallback: direct injection failed,
				// so the resolved template text (no external data) is copied on their behalf.
				await navigator.clipboard.writeText(resolved);
				new Notice("Template copied — paste with Cmd+V / Ctrl+V.");
			} catch {
				new Notice("Couldn't insert or copy the template.");
			}
		}
	}

	// Shared: read all context items into formatted string parts
	private async readContextParts(): Promise<string[]> {
		const s     = this.plugin.settings;
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
		return parts;
	}

	private async handleAddContext(): Promise<void> {
		if (!this.items.length) { new Notice("Add some notes to context first."); return; }
		const s = this.plugin.settings;
		this.isAdding = true;
		this.updateContextCount();
		try {
			const parts = await this.readContextParts();
			if (!parts.length) { new Notice("No readable notes found."); return; }
			const { text, truncated } = buildContextString(parts, s.maxContextLength, s.contextPrefix);
			if (truncated) new Notice("Context truncated — limit reached.");
			if (this.currentMode === "agent") {
				this.agentChat?.injectContext(text);
				new Notice("Context added to agent chat.");
				if (s.autoClearContext) this.clearAll();
				return;
			}
			if (await this.injectIntoWebview(text)) {
				new Notice("Context pasted in chat.");
			} else {
				// Clipboard write is a user-initiated fallback: direct injection failed,
				// so the user's own note content is copied on their behalf.
				await navigator.clipboard.writeText(text);
				new Notice("Context copied — paste with Cmd+V / Ctrl+V.");
			}
			if (s.autoClearContext) this.clearAll();
		} catch (err) {
			console.error("OmniChat: failed to add context", err);
			new Notice("Couldn't read one or more notes — see console for details.");
		} finally {
			this.isAdding = false;
			this.updateContextCount();
		}
	}

	private async handleCopyContext(): Promise<void> {
		if (!this.items.length) { new Notice("Add some notes to context first."); return; }
		try {
			const s     = this.plugin.settings;
			const parts = await this.readContextParts();
			if (!parts.length) { new Notice("No readable notes found."); return; }
			const { text, truncated } = buildContextString(parts, s.maxContextLength, s.contextPrefix);
			if (truncated) new Notice("Context truncated — limit reached.");
			// Clipboard write is intentional: the user clicked "Copy" to copy
			// their own note context to the clipboard for manual pasting.
			await navigator.clipboard.writeText(text);
			new Notice("Context copied to clipboard.");
		} catch (err) {
			console.error("OmniChat: failed to copy context", err);
			new Notice("Couldn't copy context — see console for details.");
		}
	}

	// ── Save actions ──────────────────────────────────────────

	async saveSelection(): Promise<void> {
		let text = await this.readWebviewSelection();
		if (!text && this.currentMode === "browser" && getServiceKey(this.activeUrl) !== "ollama") {
			text = await this.extractLastWebviewResponse();
		}
		if (!text) {
			new Notice("Select the text you want to save in the chat first.");
			return;
		}
		const serviceKey  = getServiceKey(this.activeUrl);
		const custom      = this.plugin.settings.customServices.find(s => s.url === this.activeUrl);
		const sourceLabel = serviceKey
			? SERVICE_META.find(m => m.key === serviceKey)?.label ?? serviceKey
			: custom?.label ?? null;
		new SaveDestinationModal(
			this.app,
			text,
			this.plugin.settings.saveNoteFolder,
			this.plugin.settings.useDateSubfolder,
			sourceLabel,
			this.plugin.settings.formatAIResponse,
		).open();
	}

	// Reads whatever the user has highlighted inside the embedded page. Runs in the
	// page's own context (same channel as injection), so it's site-agnostic — no
	// per-service selectors to maintain. Returns "" when nothing is selected.
	private async readWebviewSelection(): Promise<string> {
		if (this.currentMode === "agent") {
			const sel = activeWindow.getSelection()?.toString();
			if (sel?.trim()) return sel.trim();
		}
		if (getServiceKey(this.activeUrl) === "ollama") {
			const sel = activeWindow.getSelection()?.toString();
			if (sel?.trim()) return sel.trim();
		}
		if (!this.webview?.executeJavaScript) return "";
		try {
			const result = await this.webview.executeJavaScript(
				"(function(){var s=window.getSelection?window.getSelection():null;return s?s.toString():'';})()",
			);
			return typeof result === "string" ? result.trim() : "";
		} catch { return ""; }
	}

	/** Best-effort extraction of the latest assistant response when nothing is highlighted. */
	private async extractLastWebviewResponse(): Promise<string> {
		if (!this.webview?.executeJavaScript || !this.webviewReady) return "";
		try {
			const result = await this.webview.executeJavaScript(`
				(function() {
					var selectors = [
						'[data-message-author-role="assistant"] .markdown',
						'[data-testid="assistant-message"]',
						'.font-claude-response',
						'model-response .markdown',
						'article .markdown',
						'.prose'
					];
					for (var i = 0; i < selectors.length; i++) {
						var nodes = document.querySelectorAll(selectors[i]);
						if (nodes.length > 0) {
							var last = nodes[nodes.length - 1];
							var txt = (last && (last.innerText || last.textContent) || '').trim();
							if (txt) return txt;
						}
					}
					return '';
				})()
			`);
			return typeof result === "string" ? result.trim() : "";
		} catch {
			return "";
		}
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
		
		const isOllama = getServiceKey(safeUrl) === "ollama";
		if (isOllama) {
			this.browserShellEl?.hide();
			this.nativeUiShellEl?.show();
			this.backBtnEl?.hide();
			this.forwardBtnEl?.hide();
			this.openExternalBtnEl?.hide();
			this.setLoading(false);
			this.agentChat?.setEngine("ollama");
		} else {
			this.nativeUiShellEl?.hide();
			this.browserShellEl?.show();
			if (this.webview && this.webview.src !== safeUrl) {
				this.webviewReady = false;
				this.setLoading(true);
				this.fallbackEl?.hide();
				this.webview.src = safeUrl;
			}
		}
	}

	private switchService(key: ServiceKey): void { this.switchToUrl(SERVICE_URLS[key]); }

	reloadWebview(): void {
		if (this.currentMode === "agent" || getServiceKey(this.activeUrl) === "ollama") {
			this.agentChat?.reload();
			return;
		}
		if (!this.webview) return;
		this.webviewReady = false;
		this.setLoading(true);
		this.fallbackEl?.hide();
		const src = this.webview.src;
		this.webview.src = src;
		this.armLoadWatchdog();
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
			try {
				// Clipboard write is a user-initiated fallback: direct injection failed,
				// so the user's editor selection is copied on their behalf.
				await navigator.clipboard.writeText(text);
				new Notice("Selection copied — paste with Cmd+V / Ctrl+V.");
			} catch {
				new Notice("Couldn't send or copy the selection.");
			}
		}
	}

	private async injectIntoWebview(text: string): Promise<boolean> {
		if (this.currentMode === "agent" || getServiceKey(this.activeUrl) === "ollama") {
			this.agentChat?.injectContext(text);
			return true;
		}
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

					var isTextarea = el.tagName === 'TEXTAREA';

					function fireInput(t) {
						t.dispatchEvent(new Event('input',  { bubbles: true }));
						t.dispatchEvent(new Event('change', { bubbles: true }));
					}

					// Force the field empty through the editor's own pipeline. Used after the
					// message is sent, since some sites read the DOM to send but only clear
					// their internal model afterwards — leaving the injected text stranded.
					function clearField(t) {
						try {
							if (t.tagName === 'TEXTAREA') {
								var d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
								if (d && d.set) d.set.call(t, ''); else t.value = '';
								fireInput(t);
								return;
							}
							t.focus();
							var s = t.ownerDocument.getSelection();
							var r = t.ownerDocument.createRange();
							r.selectNodeContents(t);
							s.removeAllRanges();
							s.addRange(r);
							if (!document.execCommand('delete', false)) t.textContent = '';
							t.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
						} catch (e) { /* best effort */ }
					}

					// Arm a one-shot "clear once sent" guard: when the user submits this
					// message (Enter without Shift, or a send-like button), wipe the input a
					// beat later so it never holds the already-sent text. Works on every site.
					function armAutoClear(t) {
						if (t.__omniDisarm) t.__omniDisarm();
						var fired = false;
						function schedule() {
							if (fired) return;
							fired = true;
							disarm();
							// Clear twice: once after the site reads & sends, again a beat later in
							// case the editor re-renders and restores the stale text.
							setTimeout(function () { clearField(t); }, 350);
							setTimeout(function () { clearField(t); }, 800);
						}
						function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) schedule(); }
						function onClick(e) {
							var b = e.target && e.target.closest ? e.target.closest('button,[role="button"]') : null;
							if (!b) return;
							// Match send/submit buttons across sites — many (e.g. Gemini) are
							// icon-only with the hint in the class or data-testid, not aria-label.
							var cls  = (typeof b.className === 'string') ? b.className : ((b.className && b.className.baseVal) || '');
							var hint = (
								(b.getAttribute('aria-label')  || '') + ' ' +
								(b.getAttribute('title')       || '') + ' ' +
								(b.getAttribute('data-testid') || '') + ' ' +
								cls + ' ' +
								(b.getAttribute('type')        || '')
							).toLowerCase();
							if (/send|submit/.test(hint)) schedule();
						}
						function disarm() {
							t.removeEventListener('keydown', onKey, true);
							t.ownerDocument.removeEventListener('click', onClick, true);
							t.__omniDisarm = null;
						}
						t.addEventListener('keydown', onKey, true);
						t.ownerDocument.addEventListener('click', onClick, true);
						t.__omniDisarm = disarm;
						setTimeout(function () { if (!fired) disarm(); }, 60000); // safety: never clear a much-later message
					}

					var inserted = false;
					if (isTextarea) {
						var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
						if (desc && desc.set) desc.set.call(el, el.value + ctx);
						else el.value = el.value + ctx;
						fireInput(el);
						inserted = true;
					} else {
						// contenteditable rich editor (ProseMirror/Lexical/Quill/Slate): route the
						// text through the editor's OWN paste pipeline so its internal model — not
						// just the visible DOM — holds the text. Caret to the end first, then paste.
						var sel = el.ownerDocument.getSelection();
						if (sel) {
							var range = el.ownerDocument.createRange();
							range.selectNodeContents(el);
							range.collapse(false);
							sel.removeAllRanges();
							sel.addRange(range);
						}
						try {
							var dt = new DataTransfer();
							dt.setData('text/plain', ctx);
							// dispatchEvent() returns false when the editor preventDefaults — i.e.
							// it consumed the paste and updated its model. That's our success.
							if (!el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))) inserted = true;
						} catch (e) { /* editor ignored the synthetic paste — fall through */ }
						if (!inserted) inserted = document.execCommand('insertText', false, ctx);
					}

					if (inserted) armAutoClear(el);
					return inserted;
				})(${json})
			`);
			return result === true;
		} catch { return false; }
	}

	// ── Helpers ───────────────────────────────────────────────

	private getEnabledFlags(): Record<ServiceKey, boolean> {
		const s     = this.plugin.settings;
		const flags = {} as Record<ServiceKey, boolean>;
		for (const m of SERVICE_META) flags[m.key] = s[m.enableKey];
		return flags;
	}
}
