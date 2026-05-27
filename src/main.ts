import { Editor, Menu, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { CHATGPT_URL, CLAUDE_URL, DEEPSEEK_URL, PERPLEXITY_URL, GEMINI_URL, GROK_URL, COPILOT_URL, MANUS_URL, KIMI_URL, SERVICE_URLS, ServiceKey } from "./constants";
import { ContextItem, DEFAULT_SETTINGS, DockSettings, AIChatSettingTab } from "./settings";
import { getServiceKey } from "./utils";
import { AI_CHAT_VIEW_TYPE, AI_CHAT_SPLIT_VIEW_TYPE, AIChatView } from "./views/AIChatView";

export default class AIChatPlugin extends Plugin {
	settings: DockSettings;

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

		this.addRibbonIcon("messages-square", "Open AI Hub", () => {
			void this.toggleView();
		});

		registerCommands(this);
		this.addSettingTab(new AIChatSettingTab(this.app, this));

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

	async openChatGpt(): Promise<void> {
		await this.setWebAppUrl(CHATGPT_URL);
		await this.activateView();
	}

	async openClaude(): Promise<void> {
		await this.setWebAppUrl(CLAUDE_URL);
		await this.activateView();
	}

	async openDeepSeek(): Promise<void> {
		await this.setWebAppUrl(DEEPSEEK_URL);
		await this.activateView();
	}

	async openPerplexity(): Promise<void> {
		await this.setWebAppUrl(PERPLEXITY_URL);
		await this.activateView();
	}

	async openGemini(): Promise<void> {
		await this.setWebAppUrl(GEMINI_URL);
		await this.activateView();
	}

	async openGrok(): Promise<void> {
		await this.setWebAppUrl(GROK_URL);
		await this.activateView();
	}

	async openCopilot(): Promise<void> {
		await this.setWebAppUrl(COPILOT_URL);
		await this.activateView();
	}

	async openManus(): Promise<void> {
		await this.setWebAppUrl(MANUS_URL);
		await this.activateView();
	}

	async openKimi(): Promise<void> {
		await this.setWebAppUrl(KIMI_URL);
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
		if (!this.settings.sendSelectionEnabled) { new Notice("Send selected text is disabled — enable it in AI Hub settings."); return; }
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
		this.rerenderOpenViews();
	}

	async cycleService(): Promise<void> {
		const enableMap: Record<ServiceKey, keyof DockSettings> = {
			chatgpt:    "enableChatGPT",
			claude:     "enableClaude",
			deepseek:   "enableDeepSeek",
			perplexity: "enablePerplexity",
			gemini:     "enableGemini",
			grok:       "enableGrok",
			copilot:    "enableCopilot",
			manus:      "enableManus",
			kimi:       "enableKimi",
		};
		const keys = Object.keys(SERVICE_URLS) as ServiceKey[];
		const enabled = keys.filter((k) => this.settings[enableMap[k]] as boolean);
		if (enabled.length === 0) return;
		const current = getServiceKey(this.settings.webAppUrl);
		const idx = current ? enabled.indexOf(current) : -1;
		const nextKey = enabled[(idx + 1) % enabled.length];
		if (!nextKey) return;
		await this.setWebAppUrl(SERVICE_URLS[nextKey]);
		await this.activateView();
		new Notice(`Switched to ${nextKey.charAt(0).toUpperCase() + nextKey.slice(1)}`);
	}

	async setContextItems(items: ContextItem[]): Promise<void> {
		this.settings.contextItems = items;
		await this.saveSettings();
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<DockSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
