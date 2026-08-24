import { App, Editor, Menu, Notice, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { SERVICE_META, SERVICE_URLS, ServiceKey } from "./constants";
import { fetchReleaseNotes } from "./feedback/github";
import { UpdateNotesModal } from "./modals/UpdateNotesModal";
import { UninstallFeedbackModal } from "./modals/UninstallFeedbackModal";
import { WelcomeModal } from "./modals/WelcomeModal";
import { ContextItem, DEFAULT_SETTINGS, DockSettings, AIChatSettingTab } from "./settings";
import { getCleanUserAgent, getChromeClientHints, getServiceKey } from "./utils";
import { AI_CHAT_VIEW_TYPE, AI_CHAT_SPLIT_VIEW_TYPE, AIChatView } from "./views/AIChatView";

interface ElectronWebRequest {
	onBeforeSendHeaders?: (
		listener: (
			details: { requestHeaders: Record<string, string> },
			callback: (response: { cancel: boolean; requestHeaders: Record<string, string> }) => void,
		) => void,
	) => void;
}

interface ElectronSession {
	setUserAgent?: (userAgent: string) => void;
	webRequest?: ElectronWebRequest;
	clearStorageData?: (options: { storages: string[] }) => Promise<void>;
	clearCache?: () => Promise<void>;
}

interface ElectronSessionModule {
	fromPartition?: (partition: string) => ElectronSession;
}

interface ElectronApi {
	session?: ElectronSessionModule;
	remote?: {
		session?: ElectronSessionModule;
	};
}

function getElectronApi(): ElectronApi | null {
	try {
		const g = window as unknown as { require?: (id: string) => ElectronApi };
		if (typeof g.require === "function") {
			return g.require("electron");
		}
	} catch {
		// Electron not available or in web sandbox
	}
	return null;
}

/** Internal Plugins API — uninstallPlugin is not in the public typings. */
type PluginsApi = {
	uninstallPlugin: (pluginId: string) => Promise<void>;
};

export default class AIChatPlugin extends Plugin {
	settings: DockSettings;
	private statusBarEl!: HTMLElement;
	/** True when there was no prior data.json — first-time install. */
	private isFirstInstall = false;
	/** False after onunload — skips late update-modal opens. */
	private pluginActive = false;
	/** Restored in onunload so disable does not leave a dangling patch. */
	private originalUninstallPlugin: ((pluginId: string) => Promise<void>) | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.pluginActive = true;
		this.configureElectronSession();
		this.patchUninstallFeedback();

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

		this.statusBarEl = this.addStatusBarItem();
		this.updateStatusBar();

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

		this.app.workspace.onLayoutReady(() => {
			void this.showInstallOrUpdateModal();
		});
	}

	onunload(): void {
		this.pluginActive = false;
		this.unpatchUninstallFeedback();
	}

	/**
	 * Obsidian has no public onUninstall hook. Intercept uninstallPlugin so the
	 * feedback form runs only on uninstall — not when the plugin is merely disabled.
	 */
	private patchUninstallFeedback(): void {
		const plugins = this.getPluginsApi();
		if (!plugins) return;

		this.originalUninstallPlugin = plugins.uninstallPlugin.bind(plugins);
		const original = this.originalUninstallPlugin;
		const pluginId = this.manifest.id;

		plugins.uninstallPlugin = async (id: string) => {
			if (id === pluginId) {
				await this.promptUninstallFeedback();
			}
			return original(id);
		};
	}

	private unpatchUninstallFeedback(): void {
		const plugins = this.getPluginsApi();
		if (!plugins || !this.originalUninstallPlugin) return;
		plugins.uninstallPlugin = this.originalUninstallPlugin;
		this.originalUninstallPlugin = null;
	}

	private getPluginsApi(): PluginsApi | null {
		const plugins = (this.app as App & { plugins?: PluginsApi }).plugins;
		if (!plugins || typeof plugins.uninstallPlugin !== "function") return null;
		return plugins;
	}

	/** Show the uninstall survey and wait until the user skips or submits. */
	private promptUninstallFeedback(): Promise<void> {
		return new Promise(resolve => {
			new UninstallFeedbackModal(this.app, () => resolve()).open();
		});
	}

	/**
	 * First install → welcome + feature onboarding.
	 * Version bump → changelog (GitHub release notes).
	 * Existing installs missing lastSeenVersion → set version silently (no re-onboarding).
	 */
	private async showInstallOrUpdateModal(): Promise<void> {
		const current = this.manifest.version;
		const previous = this.settings.lastSeenVersion?.trim() ?? "";

		if (!previous) {
			this.settings.lastSeenVersion = current;
			await this.saveSettings();
			if (this.isFirstInstall) {
				new WelcomeModal(this.app, this).open();
			}
			return;
		}

		if (previous === current) return;

		this.settings.lastSeenVersion = current;
		await this.saveSettings();

		const notes = await fetchReleaseNotes(current);
		if (!this.pluginActive) return;
		new UpdateNotesModal(this.app, current, previous, notes).open();
	}

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
		if (enabled.length === 0) { new Notice("No AI services enabled — enable one in OmniChat settings."); return; }
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

	async clearAllContext(): Promise<void> {
		await this.setContextItems([]);
		this.rerenderOpenViews();
	}

	updateStatusBar(): void {
		const key  = getServiceKey(this.settings.webAppUrl);
		const meta = SERVICE_META.find(m => m.key === key);
		this.statusBarEl.setText(`◈ ${meta?.label ?? "OmniChat"}`);
	}

	async addFileToContext(file: TFile): Promise<void> {
		if (!this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE).length) await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.addFileFromExternal(file);
	}

	async addActiveNoteToContext(): Promise<void> {
		if (!this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE).length) await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) view.addActiveFile();
	}

	async saveAIResponse(): Promise<void> {
		if (
			!this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE).length &&
			!this.app.workspace.getLeavesOfType(AI_CHAT_SPLIT_VIEW_TYPE).length
		) {
			await this.activateView();
		}
		const leaf = this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0]
			?? this.app.workspace.getLeavesOfType(AI_CHAT_SPLIT_VIEW_TYPE)[0];
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof AIChatView) await view.saveSelection();
	}

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
		this.isFirstInstall = Object.keys(loaded).length === 0;
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
		this.configureElectronSession();
	}

	configureElectronSession(): void {
		try {
			const electron = getElectronApi();
			const session = electron?.session ?? electron?.remote?.session;
			if (!session || typeof session.fromPartition !== "function") return;

			const ses = session.fromPartition("persist:aibrowser-chat");
			const userAgent = getCleanUserAgent(this.settings.customUserAgent);

			// 1. Set global user agent on the partition session
			if (typeof ses.setUserAgent === "function") {
				ses.setUserAgent(userAgent);
			}

			// 2. Intercept request headers to enforce Chrome client hints and remove leaking electron headers
			if (ses.webRequest && typeof ses.webRequest.onBeforeSendHeaders === "function") {
				const hints = getChromeClientHints(userAgent);
				ses.webRequest.onBeforeSendHeaders(
					(
						details: { requestHeaders: Record<string, string> },
						callback: (response: { cancel: boolean; requestHeaders: Record<string, string> }) => void,
					) => {
						const requestHeaders = { ...details.requestHeaders };

						// Ensure User-Agent is clean
						requestHeaders["User-Agent"] = userAgent;

						// Inject standard Chrome Client Hints
						requestHeaders["sec-ch-ua"] = hints.secChUa;
						requestHeaders["sec-ch-ua-mobile"] = hints.secChUaMobile;
						requestHeaders["sec-ch-ua-platform"] = hints.secChUaPlatform;

						// Remove leaking headers
						delete requestHeaders["X-Requested-With"];
						delete requestHeaders["x-requested-with"];

						callback({ cancel: false, requestHeaders });
					},
				);
			}
		} catch (err) {
			console.debug("OmniChat: Electron session configuration skipped or unavailable", err);
		}
	}

	reconfigureBrowserSession(): void {
		this.configureElectronSession();
	}

	async clearBrowserSession(): Promise<boolean> {
		try {
			const electron = getElectronApi();
			const session = electron?.session ?? electron?.remote?.session;
			if (!session || typeof session.fromPartition !== "function") return false;

			const ses = session.fromPartition("persist:aibrowser-chat");
			if (typeof ses.clearStorageData === "function") {
				await ses.clearStorageData({
					storages: ["cookies", "localstorage", "indexdb", "websql", "serviceworkers", "cachestorage"],
				});
			}
			if (typeof ses.clearCache === "function") {
				await ses.clearCache();
			}
			return true;
		} catch (err) {
			console.error("OmniChat: Failed to clear browser session", err);
			return false;
		}
	}
}
