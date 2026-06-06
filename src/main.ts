import { Editor, Menu, Notice, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { SERVICE_META, SERVICE_URLS, ServiceKey } from "./constants";
import { ContextItem, DEFAULT_SETTINGS, DockSettings, AIChatSettingTab } from "./settings";
import { getServiceKey } from "./utils";
import { AI_CHAT_VIEW_TYPE, AI_CHAT_SPLIT_VIEW_TYPE, AIChatView } from "./views/AIChatView";

export default class AIChatPlugin extends Plugin {
	settings: DockSettings;
	private statusBarEl!: HTMLElement;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			AI_CHAT_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new AIChatView(leaf, this, true),
		);

		this.registerView(
			AI_CHAT_SPLIT_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new AIChatView(leaf, this, false),
		);

		this.addRibbonIcon("messages-square", "Open OmniChat", () => {
			void this.toggleView();
		});

		registerCommands(this);
		this.addSettingTab(new AIChatSettingTab(this.app, this));

		// Feature 4: status bar shows active service
		this.statusBarEl = this.addStatusBarItem();
		this.updateStatusBar();

		// Feature 5: file-explorer context menu → add to OmniChat context
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFile)) return;
				menu.addItem(item => {
					item.setTitle("Add to OmniChat context")
						.setIcon("messages-square")
						.onClick(() => void this.addFileToContext(file));
				});
			}),
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection.trim()) return;
				menu.addItem((item) => {
					item
						.setTitle("Send selected text to AI")
						.setIcon("messages-square")
						.onClick(() => { void this.sendSelectionToAI(selection); });
				});
			}),
		);

		if (this.settings.openOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				void this.activateView();
			});
		}
	}

	onunload(): void {}

	async activateView(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);

		if (!leaf) return;

		await leaf.setViewState({ type: AI_CHAT_VIEW_TYPE, active: true });
		void this.app.workspace.revealLeaf(leaf);
	}

	async toggleView(): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (leaf) {
			leaf.detach();
			return;
		}
		await this.activateView();
	}

	async openAIChat(): Promise<void> {
		await this.activateView();
	}

	async openService(key: ServiceKey): Promise<void> {
		await this.setWebAppUrl(SERVICE_URLS[key]);
		await this.activateView();
	}

	async openSplitPanel(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(AI_CHAT_SPLIT_VIEW_TYPE)[0];
		const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: AI_CHAT_SPLIT_VIEW_TYPE, active: true });
		void this.app.workspace.revealLeaf(leaf);
	}

	async setSplitPanelUrl(url: string): Promise<void> {
		if (this.settings.splitPanelUrl === url) return;
		this.settings.splitPanelUrl = url;
		await this.saveSettings();
		this.rerenderOpenViews();
	}

	async sendSelectionToAI(text: string): Promise<void> {
		if (!this.settings.sendSelectionEnabled) { new Notice("Send selected text is disabled — enable it in OmniChat settings."); return; }
		if (!text.trim()) { new Notice("Select some text first."); return; }
		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.injectText(text);
	}

	async setWebAppUrl(url: string): Promise<void> {
		if (this.settings.webAppUrl === url) return;
		this.settings.webAppUrl = url;
		await this.saveSettings();
		this.updateStatusBar();
		this.rerenderOpenViews();
	}

	async cycleService(): Promise<void> {
		const enabled = SERVICE_META.filter(m => this.settings[m.enableKey]);
		if (enabled.length === 0) return;
		const current = getServiceKey(this.settings.webAppUrl);
		const idx     = enabled.findIndex(m => m.key === current);
		const next    = enabled[(idx + 1) % enabled.length];
		if (!next) return;
		await this.setWebAppUrl(next.url);
		await this.activateView();
		new Notice(`Switched to ${next.label}`);
	}

	async setContextItems(items: ContextItem[]): Promise<void> {
		this.settings.contextItems = items;
		await this.saveSettings();
	}

	// Feature 4
	updateStatusBar(): void {
		const key  = getServiceKey(this.settings.webAppUrl);
		const meta = SERVICE_META.find(m => m.key === key);
		this.statusBarEl.setText(`◈ ${meta?.label ?? "OmniChat"}`);
	}

	// Feature 5 helper
	async addFileToContext(file: TFile): Promise<void> {
		if (!this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE).length) await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.addFileFromExternal(file);
	}

	// Feature 6
	async addActiveNoteToContext(): Promise<void> {
		if (!this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE).length) await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.addActiveFile();
	}

	// Feature 9
	async sendSelectionWithTemplate(selection: string, templateText: string): Promise<void> {
		if (!this.settings.sendSelectionEnabled) {
			new Notice("Send selected text is disabled — enable it in OmniChat settings.");
			return;
		}
		const combined = templateText.trim() ? `${templateText}\n\n${selection}` : selection;
		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.injectText(combined);
	}

	rerenderOpenViews(): void {
		for (const type of [AI_CHAT_VIEW_TYPE, AI_CHAT_SPLIT_VIEW_TYPE]) {
			for (const leaf of this.app.workspace.getLeavesOfType(type)) {
				const view = leaf.view;
				if (view instanceof AIChatView) {
					view.renderView();
				}
			}
		}
	}

	async loadSettings(): Promise<void> {
		const loaded = ((await this.loadData()) ?? {}) as Partial<DockSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		// Migration: drop the removed `defaultService` field. Its value only ever
		// mirrored webAppUrl, which remains the single source of truth.
		delete (this.settings as Partial<DockSettings> & { defaultService?: unknown }).defaultService;

		// Defensive normalization for hand-edited or partially-corrupt data.json.
		if (!Array.isArray(this.settings.contextItems))    this.settings.contextItems    = [];
		if (!Array.isArray(this.settings.customServices))  this.settings.customServices  = [];
		if (!Array.isArray(this.settings.promptTemplates)) this.settings.promptTemplates = [...DEFAULT_SETTINGS.promptTemplates];
		if (!(this.settings.maxContextLength > 0))         this.settings.maxContextLength   = DEFAULT_SETTINGS.maxContextLength;
		if (!(this.settings.autoRefreshMinutes >= 0))      this.settings.autoRefreshMinutes = DEFAULT_SETTINGS.autoRefreshMinutes;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
