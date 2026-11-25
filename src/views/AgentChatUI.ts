import { Component, MarkdownRenderer, MarkdownView, Notice, setIcon, TFile } from "obsidian";
import type AIChatPlugin from "../main";
import { AGENT_ENGINES, type AgentEngineKey, type AgentMessage } from "../types/agent";
import { executeCliPrompt, type CliExecutionHandle, type CliToolEvent, getCliWorkingDirectory, detectCli } from "../services/AgentCliService";
import { streamAnthropic, streamOpenAI, streamOllama, fetchOllamaModels } from "../services/AgentApiService";
import { ChatHistoryService } from "../services/ChatHistoryService";
import { VaultQueryService } from "../services/VaultQueryService";
import { ContextSearchModal } from "../modals/ContextSearchModal";
import { t } from "../i18n";

function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return "Just now";
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hrs = Math.floor(min / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return "Yesterday";
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export class AgentChatUI {
	container: HTMLElement;
	plugin: AIChatPlugin;
	private component: Component;

	// ── State ─────────────────────────────────────────────────
	private messages: AgentMessage[] = [];
	private activeEngine: AgentEngineKey;
	private activeSessionId: string | null = null;
	private isGenerating = false;
	private isAskVaultActive = false;
	private cliHandle: CliExecutionHandle | null = null;
	private abortController: AbortController | null = null;
	private ollamaModels: string[] = [];
	private selectedOllamaModel = "";
	private historyFilterQuery = "";
	private generationStartedAt = 0;
	private generationTimerId: number | null = null;

	// ── DOM Refs ──────────────────────────────────────────────
	private sessionTitleEl!: HTMLElement;
	private historyDrawerEl: HTMLElement | null = null;
	private historyListContainerEl: HTMLElement | null = null;
	private askVaultBtnEl!: HTMLButtonElement;
	private inlineModelSelectEl!: HTMLSelectElement;
	private cliPermBtnEl!: HTMLButtonElement;
	private vaultBannerEl!: HTMLElement;
	private statusDotEl!: HTMLElement;
	private cwdPillEl!: HTMLElement;
	private chatLogEl!: HTMLElement;
	private scrollAreaEl!: HTMLElement;
	private contextTrayEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private statusTextEl!: HTMLElement;
	private stagedContext: { path: string; name: string; content: string }[] = [];

	constructor(parent: HTMLElement, plugin: AIChatPlugin) {
		this.container = parent.createDiv({ cls: "agent-chat-container" });
		this.plugin = plugin;
		this.component = new Component();
		this.component.load();
		this.activeEngine = this.plugin.settings.agentEngine || "claude-cli";

		if (!this.plugin.chatHistory) {
			this.plugin.chatHistory = new ChatHistoryService(this.plugin);
		}

		this.render();
		void this.initSession();
		void this.initEngineStatus();
	}

	public destroy(): void {
		if (this.generationTimerId !== null) {
			window.clearInterval(this.generationTimerId);
			this.generationTimerId = null;
		}
		this.stopGeneration();
		this.component.unload();
		this.container.empty();
	}

	public setEngine(engineKey: AgentEngineKey): void {
		this.activeEngine = engineKey;
		this.plugin.settings.agentEngine = engineKey;
		if (this.activeSessionId) {
			this.plugin.chatHistory.updateSessionMessages(this.activeSessionId, this.messages, engineKey);
		}
		this.updateEngineUI();
	}

	public getEngine(): AgentEngineKey {
		return this.activeEngine;
	}

	public reload(): void {
		this.activeEngine = this.plugin.settings.agentEngine || "claude-cli";
		this.updateEngineUI();
	}

	private async initSession(): Promise<void> {
		await this.plugin.chatHistory.loadStore();
		let session = this.plugin.chatHistory.getActiveSession();
		if (!session) {
			session = this.plugin.chatHistory.createSession(this.activeEngine, "New Chat");
		}
		this.activeSessionId = session.id;
		this.activeEngine = session.engine;
		this.messages = [...session.messages];
		this.updateSessionTitleDisplay();
		this.updateEngineUI();
		this.renderMessages();
	}

	private render(): void {
		this.container.empty();

		// ── Top Session & History Bar ──────────────────────────
		const sessionBar = this.container.createDiv({ cls: "agent-session-bar" });

		const titleWrap = sessionBar.createDiv({ cls: "agent-session-title-wrap" });
		const chatIcon = titleWrap.createSpan({ cls: "agent-session-icon" });
		setIcon(chatIcon, "messages-square");

		this.sessionTitleEl = titleWrap.createSpan({ cls: "agent-session-title", text: "New Chat" });
		this.sessionTitleEl.addEventListener("click", () => this.renameCurrentSession());

		const renameBtn = titleWrap.createEl("button", {
			cls: "agent-session-rename-btn",
			attr: { "aria-label": "Rename chat" },
		});
		setIcon(renameBtn, "pencil");
		renameBtn.title = "Rename conversation";
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.renameCurrentSession();
		});

		const navRight = sessionBar.createDiv({ cls: "agent-session-nav-right" });

		const newChatBtn = navRight.createEl("button", {
			cls: "agent-session-btn",
			attr: { "aria-label": "New chat" },
		});
		setIcon(newChatBtn, "plus");
		newChatBtn.title = "New conversation";
		newChatBtn.addEventListener("click", () => this.startNewChat());

		const historyBtn = navRight.createEl("button", {
			cls: "agent-session-btn",
			attr: { "aria-label": "Chat history" },
		});
		setIcon(historyBtn, "history");
		historyBtn.title = "Chat history";
		historyBtn.addEventListener("click", () => this.toggleHistoryDrawer());

		// ── Scroll Area & Chat Log ─────────────────────────────
		this.scrollAreaEl = this.container.createDiv({ cls: "agent-scroll-area" });
		this.chatLogEl = this.scrollAreaEl.createDiv({ cls: "agent-chat-log" });
		this.renderWelcomeCard();

		// ── Context Tray ───────────────────────────────────────
		this.contextTrayEl = this.container.createDiv({ cls: "agent-context-tray" });
		this.contextTrayEl.hide();

		// ── Input Area ─────────────────────────────────────────
		const inputContainer = this.container.createDiv({ cls: "agent-input-container" });

		// Accessories: Ask Vault & Attach Note
		const accessories = inputContainer.createDiv({ cls: "agent-input-accessories" });
		const accessoriesLeft = accessories.createDiv({ cls: "agent-input-accessories-left" });

		this.askVaultBtnEl = accessoriesLeft.createEl("button", {
			cls: `agent-dock-pill-btn ${this.isAskVaultActive ? "is-active" : ""}`,
		});
		const vaultIcon = this.askVaultBtnEl.createSpan();
		setIcon(vaultIcon, "book-open");
		this.askVaultBtnEl.createSpan({ text: "Ask Vault" });
		this.askVaultBtnEl.title = "Toggle ask vault: automatically search and ground answers in your Obsidian notes";
		this.askVaultBtnEl.addEventListener("click", () => this.toggleAskVault());

		const attachNoteBtn = accessoriesLeft.createEl("button", {
			cls: "agent-dock-pill-btn",
		});
		const attachIcon = attachNoteBtn.createSpan();
		setIcon(attachIcon, "file-plus");
		attachNoteBtn.createSpan({ text: t("agent.attachContext") });
		attachNoteBtn.title = t("view.context.addTitle");
		attachNoteBtn.addEventListener("click", () => this.openNotePicker());

		this.vaultBannerEl = accessories.createDiv({ cls: "agent-vault-active-badge" });
		const bannerIcon = this.vaultBannerEl.createSpan();
		setIcon(bannerIcon, "sparkles");
		this.vaultBannerEl.createSpan({ text: "Vault search active" });
		if (!this.isAskVaultActive) this.vaultBannerEl.hide();

		const accessoriesRight = accessories.createDiv({ cls: "agent-input-accessories-right" });

		this.inlineModelSelectEl = accessoriesRight.createEl("select", {
			cls: "agent-inline-model-select",
			attr: { "aria-label": "Select model" },
		});
		this.inlineModelSelectEl.addEventListener("change", () => {
			this.selectedOllamaModel = this.inlineModelSelectEl.value;
		});
		this.inlineModelSelectEl.hide();

		this.cliPermBtnEl = accessoriesRight.createEl("button", {
			cls: "agent-dock-pill-btn agent-perm-pill",
		});
		this.cliPermBtnEl.addEventListener("click", () => {
			this.plugin.settings.dangerouslySkipPermissions = !this.plugin.settings.dangerouslySkipPermissions;
			void this.plugin.saveSettings();
			this.updateInlineControls();
			new Notice(
				this.plugin.settings.dangerouslySkipPermissions
					? "CLI auto-approve enabled (--dangerously-skip-permissions)."
					: "CLI safe permission mode enabled.",
			);
		});
		this.updateInlineControls();

		// macOS Floating Glass Input Dock
		const inputGlass = inputContainer.createDiv({ cls: "agent-input-glass" });

		this.inputEl = inputGlass.createEl("textarea", { cls: "agent-input-box" });
		this.updatePlaceholder();
		this.inputEl.rows = 1;

		this.sendBtnEl = inputGlass.createEl("button", {
			cls: "agent-send-btn",
			attr: { "aria-label": "Send prompt" },
		});
		this.sendBtnEl.disabled = true;
		setIcon(this.sendBtnEl, "send");

		// Bottom Status Bar
		const footer = inputContainer.createDiv({ cls: "agent-footer-bar" });

		const footerLeft = footer.createDiv({ cls: "agent-footer-left" });
		this.statusDotEl = footerLeft.createDiv({ cls: "agent-status-dot is-idle" });
		this.statusDotEl.title = "Agent ready";
		this.statusTextEl = footerLeft.createDiv({ cls: "agent-footer-status" });
		this.updateStatusText();

		this.cwdPillEl = footerLeft.createDiv({ cls: "agent-cwd-pill" });
		this.updateCwdPill();

		const footerRight = footer.createDiv({ cls: "agent-footer-actions" });

		const clearBtn = footerRight.createEl("button", {
			cls: "agent-footer-btn",
			attr: { "aria-label": "New chat" },
		});
		setIcon(clearBtn, "plus-circle");
		clearBtn.title = "Start new chat";
		clearBtn.addEventListener("click", () => this.startNewChat());

		const saveBtn = footerRight.createEl("button", {
			cls: "agent-footer-btn",
			attr: { "aria-label": "Save chat to note" },
		});
		setIcon(saveBtn, "save");
		saveBtn.title = "Save conversation to note";
		saveBtn.addEventListener("click", () => void this.exportChatToNote());

		const refreshBtn = footerRight.createEl("button", {
			cls: "agent-footer-btn",
			attr: { "aria-label": "Check connection" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.title = "Check connection / reload models";
		refreshBtn.addEventListener("click", () => void this.checkConnection());

		this.setupListeners();
	}

	private setupListeners(): void {
		this.inputEl.addEventListener("input", () => {
			this.inputEl.setCssProps({ height: "auto" });
			this.inputEl.setCssProps({ height: `${Math.min(this.inputEl.scrollHeight, 140)}px` });
			this.sendBtnEl.disabled = this.inputEl.value.trim() === "" && !this.isGenerating;
		});

		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.handleSend();
			} else if (e.key === "Escape" && this.isGenerating) {
				e.preventDefault();
				this.stopGeneration();
			}
		});

		this.sendBtnEl.addEventListener("click", () => {
			if (this.isGenerating) {
				this.stopGeneration();
			} else {
				void this.handleSend();
			}
		});
	}

	// ── Session Management (New, Rename, Delete, Switch) ──────

	public startNewChat(): void {
		this.stopGeneration();
		const session = this.plugin.chatHistory.createSession(this.activeEngine, "New Chat");
		this.activeSessionId = session.id;
		this.messages = [];
		this.updateSessionTitleDisplay();
		this.renderMessages();
		this.closeHistoryDrawer();
		this.inputEl.focus();
		new Notice("Started new chat.");
	}

	public loadSession(sessionId: string): void {
		const session = this.plugin.chatHistory.setActiveSession(sessionId);
		if (!session) return;
		this.stopGeneration();
		this.activeSessionId = session.id;
		this.activeEngine = session.engine;
		this.plugin.settings.agentEngine = session.engine;
		this.messages = [...session.messages];
		this.updateSessionTitleDisplay();
		this.updateEngineUI();
		this.renderMessages();
		this.closeHistoryDrawer();
	}

	public renameCurrentSession(): void {
		if (!this.activeSessionId) return;
		const session = this.plugin.chatHistory.getSession(this.activeSessionId);
		if (!session) return;

		this.sessionTitleEl.empty();
		const input = this.sessionTitleEl.createEl("input", {
			cls: "agent-session-rename-input",
			type: "text",
			value: session.title,
		});
		input.focus();
		input.select();

		let committed = false;
		const commit = () => {
			if (committed) return;
			committed = true;
			const newTitle = input.value.trim() || session.title;
			this.plugin.chatHistory.renameSession(session.id, newTitle);
			this.updateSessionTitleDisplay();
			if (this.historyDrawerEl) this.renderHistoryList();
		};

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commit();
			} else if (e.key === "Escape") {
				committed = true;
				this.updateSessionTitleDisplay();
			}
		});
		input.addEventListener("blur", () => commit());
	}

	public deleteSession(sessionId: string): void {
		const session = this.plugin.chatHistory.getSession(sessionId);
		const title = session?.title ?? "Chat";
		const wasActive = this.activeSessionId === sessionId;

		this.plugin.chatHistory.deleteSession(sessionId);
		new Notice(`Deleted "${title}".`);

		if (wasActive) {
			const next = this.plugin.chatHistory.getActiveSession();
			if (next) {
				this.loadSession(next.id);
			} else {
				this.startNewChat();
			}
		} else {
			if (this.historyDrawerEl) this.renderHistoryList();
		}
	}

	private updateSessionTitleDisplay(): void {
		if (!this.sessionTitleEl) return;
		const session = this.activeSessionId ? this.plugin.chatHistory.getSession(this.activeSessionId) : undefined;
		this.sessionTitleEl.setText(session?.title ?? "New Chat");
		this.sessionTitleEl.title = `Current Chat: ${session?.title ?? "New Chat"} (Click to rename)`;
	}

	// ── History Drawer / Popover ───────────────────────────────

	private toggleHistoryDrawer(): void {
		if (this.historyDrawerEl) {
			this.closeHistoryDrawer();
		} else {
			this.openHistoryDrawer();
		}
	}

	private openHistoryDrawer(): void {
		if (this.historyDrawerEl) return;
		this.historyDrawerEl = this.container.createDiv({ cls: "agent-history-drawer" });
		this.renderHistoryDrawer();
	}

	private closeHistoryDrawer(): void {
		if (this.historyDrawerEl) {
			this.historyDrawerEl.remove();
			this.historyDrawerEl = null;
			this.historyListContainerEl = null;
		}
	}

	private renderHistoryDrawer(): void {
		if (!this.historyDrawerEl) return;
		this.historyDrawerEl.empty();

		const header = this.historyDrawerEl.createDiv({ cls: "agent-history-header" });
		const titleGroup = header.createDiv({ cls: "agent-history-header-left" });
		titleGroup.createSpan({ cls: "agent-history-title", text: "Chat History" });

		const allSessions = this.plugin.chatHistory.getAllSessions();
		titleGroup.createSpan({ cls: "agent-history-badge", text: `${allSessions.length}` });

		const headerActions = header.createDiv({ cls: "agent-history-header-actions" });
		const newChatBtn = headerActions.createEl("button", {
			cls: "agent-history-new-btn",
			text: "New chat",
		});
		newChatBtn.addEventListener("click", () => this.startNewChat());

		const closeBtn = headerActions.createEl("button", {
			cls: "agent-history-close-btn",
			attr: { "aria-label": "Close history" },
		});
		setIcon(closeBtn, "x");
		closeBtn.addEventListener("click", () => this.closeHistoryDrawer());

		const searchWrap = this.historyDrawerEl.createDiv({ cls: "agent-history-search-wrap" });
		const searchIcon = searchWrap.createSpan({ cls: "agent-history-search-icon" });
		setIcon(searchIcon, "search");
		const searchInput = searchWrap.createEl("input", {
			cls: "agent-history-search-input",
			type: "text",
			placeholder: "Filter chat history…",
		});
		searchInput.value = this.historyFilterQuery;
		searchInput.addEventListener("input", () => {
			this.historyFilterQuery = searchInput.value.trim().toLowerCase();
			this.renderHistoryList();
		});

		this.historyListContainerEl = this.historyDrawerEl.createDiv({ cls: "agent-history-list" });
		this.renderHistoryList();

		const footer = this.historyDrawerEl.createDiv({ cls: "agent-history-footer" });
		const clearAllBtn = footer.createEl("button", {
			cls: "agent-history-clear-all-btn",
			text: "Clear all history",
		});
		let confirmingClear = false;
		clearAllBtn.addEventListener("click", () => {
			if (!confirmingClear) {
				confirmingClear = true;
				clearAllBtn.setText("Click again to confirm clear all");
				window.setTimeout(() => {
					confirmingClear = false;
					clearAllBtn.setText("Clear all history");
				}, 4000);
				return;
			}
			this.plugin.chatHistory.clearAllSessions(this.activeEngine);
			this.startNewChat();
			new Notice("All chat history cleared.");
		});
	}

	private renderHistoryList(): void {
		if (!this.historyListContainerEl) return;
		this.historyListContainerEl.empty();

		const sessions = this.plugin.chatHistory.getAllSessions();
		const filtered = this.historyFilterQuery
			? sessions.filter(
					(s) =>
						s.title.toLowerCase().includes(this.historyFilterQuery) ||
						s.messages.some((m) => m.content.toLowerCase().includes(this.historyFilterQuery)),
				)
			: sessions;

		if (filtered.length === 0) {
			const empty = this.historyListContainerEl.createDiv({ cls: "agent-history-empty" });
			empty.setText(this.historyFilterQuery ? "No chats matching filter." : "No conversations yet.");
			return;
		}

		for (const session of filtered) {
			const item = this.historyListContainerEl.createDiv({
				cls: `agent-history-item ${session.id === this.activeSessionId ? "is-active" : ""}`,
			});

			const body = item.createDiv({ cls: "agent-history-item-body" });
			const titleEl = body.createDiv({ cls: "agent-history-item-title", text: session.title });
			titleEl.title = session.title;

			const meta = body.createDiv({ cls: "agent-history-item-meta" });
			meta.createSpan({ text: formatRelativeTime(session.updatedAt) });
			meta.createSpan({ text: "•" });
			const engMeta = AGENT_ENGINES.find((e) => e.key === session.engine);
			meta.createSpan({ text: engMeta?.badge ?? session.engine });
			if (session.messages.length > 0) {
				meta.createSpan({ text: "•" });
				meta.createSpan({ text: `${session.messages.length} msg${session.messages.length > 1 ? "s" : ""}` });
			}

			// Switch session on item click
			item.addEventListener("click", (e) => {
				const target = e.target as HTMLElement;
				if (target.closest(".agent-history-item-actions")) return;
				this.loadSession(session.id);
			});

			// Actions: Rename and Delete
			const actions = item.createDiv({ cls: "agent-history-item-actions" });

			const renameBtn = actions.createEl("button", {
				cls: "agent-history-item-action-btn",
				attr: { "aria-label": "Rename chat" },
			});
			setIcon(renameBtn, "pencil");
			renameBtn.title = "Rename";
			renameBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const current = session.title;
				titleEl.empty();
				const inlineInput = titleEl.createEl("input", {
					cls: "agent-session-rename-input",
					type: "text",
					value: current,
				});
				inlineInput.focus();
				inlineInput.select();

				let done = false;
				const saveRename = () => {
					if (done) return;
					done = true;
					const newName = inlineInput.value.trim() || current;
					this.plugin.chatHistory.renameSession(session.id, newName);
					if (session.id === this.activeSessionId) {
						this.updateSessionTitleDisplay();
					}
					this.renderHistoryList();
				};

				inlineInput.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") {
						ev.preventDefault();
						saveRename();
					} else if (ev.key === "Escape") {
						done = true;
						this.renderHistoryList();
					}
				});
				inlineInput.addEventListener("blur", () => saveRename());
			});

			const deleteBtn = actions.createEl("button", {
				cls: "agent-history-item-action-btn is-delete",
				attr: { "aria-label": "Delete chat" },
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.title = "Delete";
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.deleteSession(session.id);
			});
		}
	}

	// ── Ask Vault & Note Picker ───────────────────────────────

	public toggleAskVault(forcedState?: boolean): void {
		this.isAskVaultActive = forcedState !== undefined ? forcedState : !this.isAskVaultActive;
		if (this.isAskVaultActive) {
			this.askVaultBtnEl.addClass("is-active");
			this.vaultBannerEl.show();
			new Notice("Ask vault active: OmniChat will search and ground answers in your notes.");
		} else {
			this.askVaultBtnEl.removeClass("is-active");
			this.vaultBannerEl.hide();
		}
		this.updatePlaceholder();
	}

	public openNotePicker(): void {
		new ContextSearchModal(this.plugin.app, (file: TFile) => {
			void (async () => {
				try {
					const content = await this.plugin.app.vault.read(file);
					this.stageContext(file.basename, content, file.path);
					new Notice(`Attached [[${file.basename}]] to context.`);
				} catch (err) {
					new Notice(`Failed to read "${file.basename}": ${String(err)}`);
				}
			})();
		}).open();
	}

	private updatePlaceholder(): void {
		if (this.isAskVaultActive) {
			this.inputEl.placeholder = "Ask your vault anything… (Shift+Enter for newline)";
			return;
		}
		const meta = AGENT_ENGINES.find((e) => e.key === this.activeEngine);
		if (meta?.type === "cli") {
			this.inputEl.placeholder = `Ask ${meta.label}… (Shift+Enter for newline)`;
		} else {
			this.inputEl.placeholder = `Ask ${meta?.label ?? "AI"}… (Shift+Enter for newline)`;
		}
	}

	private updateCwdPill(): void {
		const cwd = getCliWorkingDirectory(this.plugin.app, this.plugin.settings);
		const folderName = cwd ? cwd.split(/[/\\]/).pop() : "Vault";
		this.cwdPillEl.empty();
		const iconSpan = this.cwdPillEl.createSpan({ cls: "agent-cwd-icon" });
		setIcon(iconSpan, "folder-git-2");
		this.cwdPillEl.createSpan({ text: folderName || "Vault" });
		this.cwdPillEl.title = `Working directory: ${cwd}`;
	}

	private updateStatusText(custom?: string): void {
		if (custom) {
			this.statusTextEl.setText(custom);
			return;
		}
		const meta = AGENT_ENGINES.find((e) => e.key === this.activeEngine);
		if (this.isGenerating) {
			const elapsed = this.generationStartedAt > 0
				? Math.floor((Date.now() - this.generationStartedAt) / 1000)
				: 0;
			const timerSuffix = elapsed > 0 ? ` · ${elapsed}s` : "";
			this.statusTextEl.setText(`Running ${meta?.label ?? "agent"}…${timerSuffix}`);
		} else {
			this.statusTextEl.setText(`${meta?.label ?? "Agent"} ready`);
		}
	}

	private updateInlineControls(): void {
		if (!this.inlineModelSelectEl || !this.cliPermBtnEl) return;
		const meta = AGENT_ENGINES.find((e) => e.key === this.activeEngine);
		if (this.activeEngine === "ollama" && this.ollamaModels.length > 0) {
			this.inlineModelSelectEl.empty();
			for (const model of this.ollamaModels) {
				const opt = this.inlineModelSelectEl.createEl("option", { text: model, value: model });
				if (model === this.selectedOllamaModel) opt.selected = true;
			}
			this.inlineModelSelectEl.show();
		} else {
			this.inlineModelSelectEl.hide();
		}

		if (meta?.type === "cli" && (this.activeEngine === "claude-cli" || this.activeEngine === "antigravity-cli")) {
			const autoApprove = this.plugin.settings.dangerouslySkipPermissions;
			this.cliPermBtnEl.empty();
			setIcon(this.cliPermBtnEl.createSpan(), autoApprove ? "shield-alert" : "shield-check");
			this.cliPermBtnEl.createSpan({ text: autoApprove ? "Auto-approve" : "Safe mode" });
			if (autoApprove) this.cliPermBtnEl.addClass("is-warning");
			else this.cliPermBtnEl.removeClass("is-warning");
			this.cliPermBtnEl.title = autoApprove
				? "CLI runs with --dangerously-skip-permissions (click to switch to safe mode)"
				: "CLI asks for permission before edits/commands (click to toggle auto-approve)";
			this.cliPermBtnEl.show();
		} else {
			this.cliPermBtnEl.hide();
		}
	}

	private updateEngineUI(): void {
		this.updatePlaceholder();
		this.updateCwdPill();
		this.updateStatusText();
		this.updateInlineControls();
		void this.initEngineStatus();
	}

	private async initEngineStatus(): Promise<void> {
		this.statusDotEl.className = "agent-status-dot is-idle";
		if (this.activeEngine === "ollama") {
			this.ollamaModels = await fetchOllamaModels(this.plugin.settings.ollamaApiUrl);
			if (this.ollamaModels.length > 0) {
				if (!this.selectedOllamaModel || !this.ollamaModels.includes(this.selectedOllamaModel)) {
					this.selectedOllamaModel = this.ollamaModels[0] ?? "";
				}
				this.statusDotEl.className = "agent-status-dot is-ready";
				this.updateStatusText(`Ollama ready: ${this.ollamaModels.length} models found`);
			} else {
				this.statusDotEl.className = "agent-status-dot is-error";
				this.updateStatusText("Ollama not running or no models installed");
			}
			this.updateInlineControls();
		} else {
			const meta = AGENT_ENGINES.find((e) => e.key === this.activeEngine);
			if (meta?.type === "cli") {
				if (this.activeEngine === "custom-cli") {
					const customBin = this.plugin.settings.customCliCommand.trim().split(/\s+/)[0] ?? "";
					if (!customBin) {
						this.statusDotEl.className = "agent-status-dot is-warning";
						this.updateStatusText("Custom CLI command not configured");
						return;
					}
					const res = await detectCli(customBin);
					if (res.found) {
						this.statusDotEl.className = "agent-status-dot is-ready";
						this.updateStatusText(`Custom CLI ready (${res.path})`);
					} else {
						this.statusDotEl.className = "agent-status-dot is-warning";
						this.updateStatusText(`"${customBin}" not found in PATH`);
					}
					return;
				}
				const bin = meta.defaultCommand || "claude";
				const custom =
					this.activeEngine === "claude-cli"
						? this.plugin.settings.claudeCliPath
						: this.activeEngine === "antigravity-cli"
							? this.plugin.settings.antigravityCliPath
							: this.plugin.settings.codexCliPath;
				const res = await detectCli(bin, custom);
				if (res.found) {
					this.statusDotEl.className = "agent-status-dot is-ready";
					this.updateStatusText(`${meta.label} ready (${res.version ?? "installed"})`);
				} else {
					this.statusDotEl.className = "agent-status-dot is-warning";
					this.updateStatusText(`${meta.label} not detected in standard PATH`);
				}
			} else {
				this.statusDotEl.className = "agent-status-dot is-ready";
			}
		}
	}

	public async checkConnection(): Promise<void> {
		new Notice(`Checking ${this.activeEngine} connection…`);
		await this.initEngineStatus();
		new Notice("Connection check complete.");
	}

	// ── Context Staging ───────────────────────────────────────

	public stageContext(name: string, content: string, path = ""): void {
		this.stagedContext.push({ name, content, path });
		this.renderContextTray();
	}

	private renderContextTray(): void {
		if (this.stagedContext.length === 0) {
			this.contextTrayEl.empty();
			this.contextTrayEl.hide();
			return;
		}

		this.contextTrayEl.empty();
		this.contextTrayEl.show();

		const title = this.contextTrayEl.createDiv({ cls: "agent-context-tray-title" });
		title.createSpan({ text: `Attached Context (${String(this.stagedContext.length)}):` });

		const pillsContainer = this.contextTrayEl.createDiv({ cls: "agent-context-pills" });
		this.stagedContext.forEach((item, idx) => {
			const pill = pillsContainer.createDiv({ cls: "agent-context-pill" });
			const iconSpan = pill.createSpan({ cls: "agent-pill-icon" });
			setIcon(iconSpan, "file-text");
			pill.createSpan({ text: item.name });

			const removeBtn = pill.createSpan({ cls: "agent-pill-remove", text: "✕" });
			removeBtn.addEventListener("click", () => {
				this.stagedContext.splice(idx, 1);
				this.renderContextTray();
			});
		});
	}

	public injectContext(text: string, executeImmediately = false): void {
		if (executeImmediately) {
			void this.sendMessageDirect(text);
			return;
		}
		this.inputEl.value = this.inputEl.value ? `${this.inputEl.value}\n\n${text}` : text;
		this.inputEl.dispatchEvent(new Event("input"));
		this.inputEl.focus();
	}

	// ── Chat Log Rendering ────────────────────────────────────

	private renderMessages(): void {
		this.chatLogEl.empty();
		if (this.messages.length === 0) {
			this.renderWelcomeCard();
			return;
		}

		for (const m of this.messages) {
			const { thoughtEl, toolsEl } = this.appendMessage(
				m.role === "system" ? "assistant" : m.role,
				m.content,
				m.contextFiles,
				m.tools,
			);
			if (m.thoughts && thoughtEl) {
				thoughtEl.parentElement?.show();
				thoughtEl.setText(m.thoughts);
			}
			if (m.tools && m.tools.length > 0 && toolsEl) {
				toolsEl.show();
			}
		}
		this.scrollToBottom();
	}

	private renderWelcomeCard(): void {
		const card = this.chatLogEl.createDiv({ cls: "agent-welcome-card" });
		const iconEl = card.createDiv({ cls: "agent-welcome-icon" });
		setIcon(iconEl, "sparkles");
		card.createEl("h3", { text: "Where should we begin?" });

		card.createEl("p", {
			text: "Ask questions, query your vault notes, or run agent workspace tasks.",
		});

		const quickChips = card.createDiv({ cls: "agent-quick-chips" });
		const samplePrompts = [
			{ label: "Ask Vault: What notes mention...", isVault: true, text: "What notes mention " },
			{ label: "Summarize active note", isVault: false, text: "Summarize my active note" },
			{ label: "Find notes with TODO", isVault: true, text: "List all notes with TODO or action items" },
			{ label: "Draft note outline", isVault: false, text: "Draft a clear outline for " },
		];

		for (const p of samplePrompts) {
			const chip = quickChips.createEl("button", { cls: "agent-quick-chip", text: p.label });
			chip.addEventListener("click", () => {
				if (p.isVault) {
					this.toggleAskVault(true);
				}
				this.inputEl.value = p.text;
				this.inputEl.dispatchEvent(new Event("input"));
				this.inputEl.focus();
			});
		}
	}

	private appendMessage(
		role: "user" | "assistant",
		content: string,
		contextFiles?: string[],
		tools?: AgentMessage["tools"],
	): {
		wrapper: HTMLElement;
		bodyEl: HTMLElement;
		thoughtEl?: HTMLElement;
		toolsEl?: HTMLElement;
		stderrEl?: HTMLElement;
	} {
		const welcome = this.chatLogEl.querySelector(".agent-welcome-card");
		if (welcome) welcome.remove();

		const wrapper = this.chatLogEl.createDiv({ cls: `agent-msg-wrapper ${role}` });
		const bubble = wrapper.createDiv({ cls: `agent-bubble ${role}` });

		// Attached context badges for user messages
		if (role === "user" && contextFiles && contextFiles.length > 0) {
			const ctxContainer = bubble.createDiv({ cls: "agent-bubble-context-list" });
			for (const f of contextFiles) {
				const badge = ctxContainer.createSpan({ cls: "agent-bubble-context-badge" });
				const icon = badge.createSpan({ cls: "agent-badge-icon" });
				setIcon(icon, f.startsWith("📚") ? "book-open" : "paperclip");
				badge.createSpan({ text: f });
			}
		}

		let thoughtEl: HTMLElement | undefined;
		let toolsEl: HTMLElement | undefined;
		let stderrEl: HTMLElement | undefined;
		if (role === "assistant" && this.plugin.settings.showThoughts) {
			const thoughtDetails = bubble.createEl("details", { cls: "agent-thought-block" });
			thoughtDetails.createEl("summary", { text: "Reasoning & thoughts" });
			thoughtEl = thoughtDetails.createDiv({ cls: "agent-thought-content" });
			thoughtDetails.hide();
		}

		if (role === "assistant") {
			toolsEl = bubble.createDiv({ cls: "agent-tools-container" });
			if (!tools || tools.length === 0) {
				toolsEl.hide();
			} else {
				for (const t of tools) {
					this.upsertToolCard(toolsEl, {
						id: `${t.name}-${Math.random()}`,
						name: t.name,
						input: t.input,
						output: t.output,
						status: t.status,
					});
				}
			}
		}

		const bodyEl = bubble.createDiv({ cls: "agent-bubble-body markdown-rendered" });

		if (content) {
			void this.renderMarkdownContent(bodyEl, content);
		}

		if (role === "assistant") {
			const stderrDetails = bubble.createEl("details", { cls: "agent-stderr-block" });
			stderrDetails.createEl("summary", { text: "CLI diagnostics (stderr)" });
			stderrEl = stderrDetails.createEl("pre", { cls: "agent-stderr-content" });
			stderrDetails.hide();
		}

		// Message footer actions for assistant
		if (role === "assistant") {
			const actionsBar = wrapper.createDiv({ cls: "agent-msg-actions" });

			const copyBtn = actionsBar.createEl("button", {
				cls: "agent-action-btn",
				attr: { "aria-label": "Copy text" },
			});
			setIcon(copyBtn, "copy");
			copyBtn.title = "Copy to clipboard";
			copyBtn.addEventListener("click", () => {
				void navigator.clipboard.writeText(content);
				new Notice("Copied response to clipboard.");
			});

			const insertBtn = actionsBar.createEl("button", {
				cls: "agent-action-btn",
				attr: { "aria-label": "Insert in active note" },
			});
			setIcon(insertBtn, "file-input");
			insertBtn.title = "Insert at cursor in active document";
			insertBtn.addEventListener("click", () => {
				const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.editor) {
					view.editor.replaceSelection(content);
					new Notice("Inserted into active document.");
				} else {
					new Notice("No active Markdown editor to insert into.");
				}
			});

			const saveNoteBtn = actionsBar.createEl("button", {
				cls: "agent-action-btn",
				attr: { "aria-label": "Save as new note" },
			});
			setIcon(saveNoteBtn, "file-plus");
			saveNoteBtn.title = "Save response as note in vault";
			saveNoteBtn.addEventListener("click", () => {
				void this.saveTextToNote(content);
			});
		}

		this.scrollToBottom();
		return { wrapper, bodyEl, thoughtEl, toolsEl, stderrEl };
	}

	private upsertToolCard(container: HTMLElement, event: CliToolEvent): void {
		container.show();
		const safeId = event.id.replace(/[^a-zA-Z0-9_-]/g, "_");
		let card = container.querySelector<HTMLDetailsElement>(`[data-tool-id="${safeId}"]`);
		if (!card) {
			card = container.createEl("details", { cls: "agent-tool-card" });
			card.setAttribute("data-tool-id", safeId);
		} else {
			card.empty();
		}

		card.removeClass("is-running", "is-done", "is-error");
		card.addClass(`is-${event.status}`);

		const summary = card.createEl("summary", { cls: "agent-tool-summary" });
		const iconEl = summary.createSpan({ cls: "agent-tool-icon" });
		setIcon(
			iconEl,
			event.status === "running"
				? "loader"
				: event.status === "error"
					? "alert-circle"
					: "check-circle-2",
		);
		summary.createSpan({ cls: "agent-tool-name", text: event.name });
		summary.createSpan({
			cls: "agent-tool-status",
			text: event.status === "running" ? "Running" : event.status === "error" ? "Error" : "Done",
		});

		if (event.input) {
			const inputPre = card.createEl("pre", { cls: "agent-tool-pre" });
			inputPre.createEl("code", { text: event.input });
		}
		if (event.output) {
			const outPre = card.createEl("pre", { cls: "agent-tool-pre agent-tool-output" });
			outPre.createEl("code", { text: event.output });
		}
	}

	private async renderMarkdownContent(targetEl: HTMLElement, markdown: string): Promise<void> {
		targetEl.empty();
		try {
			await MarkdownRenderer.render(
				this.plugin.app,
				markdown,
				targetEl,
				"",
				this.component,
			);
			this.attachCodeBlockActions(targetEl);
		} catch {
			targetEl.setText(markdown);
		}
	}

	private attachCodeBlockActions(container: HTMLElement): void {
		const pres = container.querySelectorAll("pre");
		pres.forEach((pre) => {
			if (pre.querySelector(".agent-code-actions")) return;
			const code = pre.querySelector("code");
			if (!code) return;

			const bar = pre.createDiv({ cls: "agent-code-actions" });

			const copyBtn = bar.createEl("button", { cls: "agent-code-btn", text: "Copy" });
			copyBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void navigator.clipboard.writeText(code.innerText);
				copyBtn.setText("Copied!");
				window.setTimeout(() => copyBtn.setText("Copy"), 1500);
			});

			const insertBtn = bar.createEl("button", { cls: "agent-code-btn", text: "Insert" });
			insertBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.editor) {
					view.editor.replaceSelection(code.innerText);
					new Notice("Inserted code into active note.");
				} else {
					new Notice("No active note found.");
				}
			});
		});
	}

	private scrollToBottom(): void {
		if (this.plugin.settings.autoScrollChat) {
			this.scrollAreaEl.scrollTop = this.scrollAreaEl.scrollHeight;
		}
	}

	// ── Sending & Execution ───────────────────────────────────

	private async handleSend(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text) return;
		this.inputEl.value = "";
		this.inputEl.setCssProps({ height: "auto" });
		this.sendBtnEl.disabled = true;

		await this.sendMessageDirect(text);
	}

	private async sendMessageDirect(userPrompt: string): Promise<void> {
		if (this.isGenerating) return;

		let promptWithContext = userPrompt;
		const contextNames = this.stagedContext.map((c) => c.name);
		const consultedNotes: string[] = [];

		// Automatic Vault Grounding when Ask Vault is active
		if (this.isAskVaultActive || userPrompt.includes("@vault")) {
			const cleanQuery = userPrompt.replace(/@vault\b/gi, "").trim();
			this.updateStatusText("Searching vault notes…");
			try {
				const vaultResults = await VaultQueryService.queryVault(
					this.plugin.app,
					cleanQuery || userPrompt,
					{
						maxNotes: 4,
						maxCharsPerNote: 2000,
					},
				);
				if (vaultResults.length > 0) {
					consultedNotes.push(...vaultResults.map((r) => r.title));
					promptWithContext = VaultQueryService.formatVaultPrompt(vaultResults, promptWithContext);
					new Notice(`Retrieved ${vaultResults.length} vault note${vaultResults.length > 1 ? "s" : ""} for context.`);
				}
			} catch (err) {
				console.warn("OmniChat: Vault query search failed", err);
			}
		}

		if (this.stagedContext.length > 0) {
			const ctxBlocks = this.stagedContext
				.map((c) => `--- File: ${c.name} ---\n${c.content}\n--- End of ${c.name} ---`)
				.join("\n\n");
			promptWithContext = `${this.plugin.settings.contextPrefix ? `${this.plugin.settings.contextPrefix}\n\n` : ""}${ctxBlocks}\n\nUser Question:\n${promptWithContext}`;
			this.stagedContext = [];
			this.renderContextTray();
		}

		const allContextBadges = [
			...contextNames,
			...consultedNotes.map((n) => `📚 ${n}`),
		];

		// Append user message to log & state
		this.appendMessage("user", userPrompt, allContextBadges);
		this.messages.push({
			id: Date.now().toString(),
			role: "user",
			content: userPrompt,
			timestamp: Date.now(),
			engine: this.activeEngine,
			contextFiles: allContextBadges,
		});

		// Save session and auto-derive title from first message
		if (this.activeSessionId) {
			const updated = this.plugin.chatHistory.updateSessionMessages(
				this.activeSessionId,
				this.messages,
				this.activeEngine,
			);
			if (updated) {
				this.updateSessionTitleDisplay();
			}
		}

		// Start generation
		this.setGeneratingState(true);

		const { bodyEl, thoughtEl, toolsEl, stderrEl } = this.appendMessage("assistant", "");
		bodyEl.createSpan({ cls: "agent-typing-dot" });
		bodyEl.createSpan({ cls: "agent-typing-dot" });
		bodyEl.createSpan({ cls: "agent-typing-dot" });

		let accumulatedResponse = "";
		let accumulatedThoughts = "";
		let accumulatedStderr = "";
		let insideThought = false;
		let renderTimer: number | null = null;
		const trackedTools: CliToolEvent[] = [];

		const scheduleMarkdownRender = () => {
			if (renderTimer !== null) return;
			renderTimer = window.setTimeout(() => {
				renderTimer = null;
				if (accumulatedResponse) {
					void this.renderMarkdownContent(bodyEl, accumulatedResponse);
					this.scrollToBottom();
				}
			}, 120);
		};

		const onThoughtChunk = (thoughtChunk: string) => {
			accumulatedThoughts += thoughtChunk;
			if (thoughtEl) {
				thoughtEl.parentElement?.show();
				thoughtEl.setText(accumulatedThoughts);
			}
			this.scrollToBottom();
		};

		const onToolEvent = (event: CliToolEvent) => {
			if (bodyEl.querySelector(".agent-typing-dot")) {
				bodyEl.empty();
			}
			const existing = trackedTools.find((t) => t.id === event.id);
			if (existing) {
				existing.status = event.status;
				if (event.output !== undefined) existing.output = event.output;
				if (toolsEl) this.upsertToolCard(toolsEl, existing);
			} else {
				trackedTools.push({ ...event });
				if (toolsEl) this.upsertToolCard(toolsEl, event);
			}
			this.scrollToBottom();
		};

		const onStderr = (text: string) => {
			accumulatedStderr += text;
			if (stderrEl && accumulatedStderr.trim()) {
				stderrEl.parentElement?.show();
				stderrEl.setText(accumulatedStderr.trim());
			}
		};

		const onChunk = (chunk: string) => {
			if (bodyEl.querySelector(".agent-typing-dot")) {
				bodyEl.empty();
			}

			// Process thinking tags if present
			if (chunk.includes("<think>")) {
				insideThought = true;
			}

			if (insideThought) {
				if (chunk.includes("</think>")) {
					insideThought = false;
					const [thoughtPart, rest] = chunk.split("</think>");
					accumulatedThoughts += thoughtPart?.replace("<think>", "") ?? "";
					if (thoughtEl) {
						thoughtEl.parentElement?.show();
						thoughtEl.setText(accumulatedThoughts);
					}
					accumulatedResponse += rest ?? "";
					scheduleMarkdownRender();
				} else {
					accumulatedThoughts += chunk.replace("<think>", "");
					if (thoughtEl) {
						thoughtEl.parentElement?.show();
						thoughtEl.setText(accumulatedThoughts);
					}
				}
			} else {
				accumulatedResponse += chunk;
				scheduleMarkdownRender();
			}

			this.scrollToBottom();
		};

		const onDone = (fullText: string) => {
			if (renderTimer !== null) {
				window.clearTimeout(renderTimer);
				renderTimer = null;
			}
			this.setGeneratingState(false);
			accumulatedResponse = fullText;
			void this.renderMarkdownContent(bodyEl, accumulatedResponse);
			this.messages.push({
				id: Date.now().toString(),
				role: "assistant",
				content: accumulatedResponse,
				thoughts: accumulatedThoughts || undefined,
				tools: trackedTools.length > 0
					? trackedTools.map(({ name, input, output, status }) => ({ name, input, output, status }))
					: undefined,
				timestamp: Date.now(),
				engine: this.activeEngine,
			});

			if (this.activeSessionId) {
				this.plugin.chatHistory.updateSessionMessages(
					this.activeSessionId,
					this.messages,
					this.activeEngine,
				);
			}
		};

		const onError = (errMsg: string) => {
			if (renderTimer !== null) {
				window.clearTimeout(renderTimer);
				renderTimer = null;
			}
			this.setGeneratingState(false);
			bodyEl.empty();
			const errBox = bodyEl.createDiv({ cls: "agent-error-box" });
			const icon = errBox.createSpan({ cls: "agent-error-icon" });
			setIcon(icon, "alert-triangle");
			errBox.createSpan({ text: errMsg });
			new Notice(`OmniChat: ${errMsg}`);
		};

		const meta = AGENT_ENGINES.find((e) => e.key === this.activeEngine);

		if (meta?.type === "cli") {
			this.cliHandle = executeCliPrompt({
				app: this.plugin.app,
				settings: this.plugin.settings,
				engine: this.activeEngine,
				prompt: promptWithContext,
				onChunk,
				onThoughtChunk,
				onToolEvent,
				onStderr,
				onDone,
				onError,
			});
		} else if (this.activeEngine === "anthropic-api") {
			this.abortController = new AbortController();
			const history = this.messages.map((m) => ({ role: m.role, content: m.content }));
			void streamAnthropic({
				apiKey: this.plugin.settings.anthropicApiKey,
				model: this.plugin.settings.anthropicModel,
				messages: history,
				systemPrompt: "You are an expert AI assistant helping with research and note-taking inside Obsidian.",
				onChunk,
				onDone,
				onError,
				signal: this.abortController.signal,
			});
		} else if (this.activeEngine === "openai-api") {
			this.abortController = new AbortController();
			const history = this.messages.map((m) => ({ role: m.role, content: m.content }));
			void streamOpenAI({
				apiKey: this.plugin.settings.openaiApiKey,
				baseUrl: this.plugin.settings.openaiBaseUrl,
				model: this.plugin.settings.openaiModel,
				messages: history,
				systemPrompt: "You are an expert AI coding and writing assistant in Obsidian.",
				onChunk,
				onDone,
				onError,
				signal: this.abortController.signal,
			});
		} else if (this.activeEngine === "ollama") {
			this.abortController = new AbortController();
			const history = this.messages.map((m) => ({ role: m.role, content: m.content }));
			void streamOllama({
				baseUrl: this.plugin.settings.ollamaApiUrl,
				model: this.selectedOllamaModel || "llama3",
				messages: history,
				onChunk,
				onDone,
				onError,
				signal: this.abortController.signal,
			});
		}
	}

	private setGeneratingState(isGenerating: boolean): void {
		this.isGenerating = isGenerating;
		if (this.generationTimerId !== null) {
			window.clearInterval(this.generationTimerId);
			this.generationTimerId = null;
		}
		if (isGenerating) {
			this.generationStartedAt = Date.now();
			this.sendBtnEl.empty();
			this.sendBtnEl.createDiv({ cls: "agent-stop-square" });
			this.sendBtnEl.disabled = false;
			this.sendBtnEl.classList.add("is-generating");
			this.statusDotEl.className = "agent-status-dot is-running";
			this.updateStatusText();
			this.generationTimerId = window.setInterval(() => {
				if (this.isGenerating) this.updateStatusText();
			}, 1000);
		} else {
			this.generationStartedAt = 0;
			this.sendBtnEl.empty();
			setIcon(this.sendBtnEl, "send");
			this.sendBtnEl.classList.remove("is-generating");
			this.statusDotEl.className = "agent-status-dot is-ready";
			this.inputEl.dispatchEvent(new Event("input"));
			this.updateStatusText();
			this.cliHandle = null;
			this.abortController = null;
		}
	}

	private stopGeneration(): void {
		if (this.cliHandle) {
			this.cliHandle.kill();
			this.cliHandle = null;
		}
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.setGeneratingState(false);
		new Notice("Generation stopped.");
	}

	private async exportChatToNote(): Promise<void> {
		if (this.messages.length === 0) {
			new Notice("No messages to export.");
			return;
		}

		const currentTitle = this.activeSessionId
			? this.plugin.chatHistory.getSession(this.activeSessionId)?.title
			: undefined;

		let md = `# ${currentTitle ?? "OmniChat Conversation"} (${new Date().toLocaleString()})\n\n`;
		md += `**Engine:** ${this.activeEngine}\n\n---\n\n`;

		for (const m of this.messages) {
			const label = m.role === "user" ? "🧑 **User**" : `🤖 **${m.engine}**`;
			md += `### ${label}\n\n${m.content}\n\n`;
			if (m.thoughts) {
				md += `> [!NOTE] Thoughts\n> ${m.thoughts.replace(/\n/g, "\n> ")}\n\n`;
			}
		}

		await this.saveTextToNote(md, `${currentTitle ?? "OmniChat"} - ${new Date().toISOString().substring(0, 10)}.md`);
	}

	private async saveTextToNote(content: string, defaultName?: string): Promise<void> {
		try {
			const folderPath = this.plugin.settings.saveNoteFolder.trim() || "AI Notes";
			if (!(await this.plugin.app.vault.adapter.exists(folderPath))) {
				await this.plugin.app.vault.createFolder(folderPath);
			}

			const fileName = defaultName || `AI Response ${Date.now()}.md`;
			const fullPath = `${folderPath}/${fileName}`;
			const file = await this.plugin.app.vault.create(fullPath, content);
			if (file instanceof TFile) {
				new Notice(`Saved note to ${fullPath}`);
			}
		} catch (err) {
			new Notice(`Failed to save note: ${String(err)}`);
		}
	}
}
