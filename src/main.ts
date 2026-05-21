import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { CHATGPT_URL, CLAUDE_URL, DEEPSEEK_URL, PERPLEXITY_URL, GEMINI_URL, GROK_URL } from "./constants";
import { ContextItem, DEFAULT_SETTINGS, DockSettings, AIChatSettingTab } from "./settings";
import { AI_CHAT_VIEW_TYPE, AIChatView } from "./views/AIChatView";

export default class AIChatPlugin extends Plugin {
	settings: DockSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			AI_CHAT_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new AIChatView(leaf, this),
		);

		this.addRibbonIcon("messages-square", "Open AI chat", () => {
			void this.toggleView();
		});

		registerCommands(this);
		this.addSettingTab(new AIChatSettingTab(this.app, this));

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

	async sendSelectionToAI(text: string): Promise<void> {
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

	async setContextItems(items: ContextItem[]): Promise<void> {
		this.settings.contextItems = items;
		await this.saveSettings();
	}

	rerenderOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof AIChatView) {
				view.renderView();
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
