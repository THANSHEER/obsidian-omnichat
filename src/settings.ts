import { App, PluginSettingTab, Setting } from "obsidian";
import AIChatPlugin from "./main";
import { CHATGPT_URL, ServiceKey, SERVICE_URLS } from "./constants";

export interface ContextItem {
	path: string;
	type: "file" | "folder";
	displayName: string;
}

export interface PromptTemplate {
	id: string;
	label: string;
	text: string;
}

export type ThemeMode = "auto" | "light" | "dark";

export interface DockSettings {
	webAppUrl: string;
	openOnStartup: boolean;
	maxContextLength: number;
	contextItems: ContextItem[];
	enableChatGPT: boolean;
	enableClaude: boolean;
	enableDeepSeek: boolean;
	enablePerplexity: boolean;
	enableGemini: boolean;
	enableGrok: boolean;
	enableCopilot: boolean;
	enableManus: boolean;
	enableKimi: boolean;
	autoRefreshMinutes: number;
	defaultService: ServiceKey;
	autoClearContext: boolean;
	contextPrefix: string;
	theme: ThemeMode;
	sendSelectionEnabled: boolean;
	promptTemplates: PromptTemplate[];
	autoContextOnOpen: boolean;
	stripFrontmatter: boolean;
	saveNoteFolder: string;
}

export const DEFAULT_SETTINGS: DockSettings = {
	webAppUrl: CHATGPT_URL,
	openOnStartup: true,
	maxContextLength: 50000,
	contextItems: [],
	enableChatGPT: true,
	enableClaude: true,
	enableDeepSeek: true,
	enablePerplexity: true,
	enableGemini: true,
	enableGrok: true,
	enableCopilot: true,
	enableManus: true,
	enableKimi: true,
	autoRefreshMinutes: 60,
	defaultService: "chatgpt",
	autoClearContext: false,
	contextPrefix: "",
	theme: "auto",
	sendSelectionEnabled: true,
	promptTemplates: [
		{ id: "t1", label: "Summarize", text: "Please summarize the following note concisely:\n\n" },
		{ id: "t2", label: "Fix grammar", text: "Please fix the grammar and spelling in the following text:\n\n" },
		{ id: "t3", label: "Expand idea", text: "Please expand on the following idea with more depth and detail:\n\n" },
	],
	autoContextOnOpen: false,
	stripFrontmatter: false,
	saveNoteFolder: "AI Notes",
};

export class AIChatSettingTab extends PluginSettingTab {
	plugin: AIChatPlugin;

	constructor(app: App, plugin: AIChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("AI services").setHeading();

		new Setting(containerEl)
			.setName("Enable ChatGPT")
			.setDesc("Show ChatGPT in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableChatGPT).onChange(async (v) => {
					this.plugin.settings.enableChatGPT = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable Claude")
			.setDesc("Show Claude in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableClaude).onChange(async (v) => {
					this.plugin.settings.enableClaude = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable DeepSeek")
			.setDesc("Show DeepSeek in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableDeepSeek).onChange(async (v) => {
					this.plugin.settings.enableDeepSeek = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable Perplexity")
			.setDesc("Show Perplexity in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enablePerplexity).onChange(async (v) => {
					this.plugin.settings.enablePerplexity = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable Gemini")
			.setDesc("Show Google Gemini in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableGemini).onChange(async (v) => {
					this.plugin.settings.enableGemini = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable Grok")
			.setDesc("Show Grok (xAI) in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableGrok).onChange(async (v) => {
					this.plugin.settings.enableGrok = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable copilot")
			.setDesc("Show microsoft copilot in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableCopilot).onChange(async (v) => {
					this.plugin.settings.enableCopilot = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable manus AI")
			.setDesc("Show manus AI in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableManus).onChange(async (v) => {
					this.plugin.settings.enableManus = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Enable kimi")
			.setDesc("Show kimi (moonshot AI) in the service dropdown.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableKimi).onChange(async (v) => {
					this.plugin.settings.enableKimi = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl).setName("Sidebar").setHeading();

		new Setting(containerEl)
			.setName("Theme")
			.setDesc("Control the colour scheme of the AI chat header. Auto follows Obsidian's current theme.")
			.addDropdown((d) => {
				d.addOption("auto",  "Auto (follow Obsidian)");
				d.addOption("light", "Light");
				d.addOption("dark",  "Dark");
				d.setValue(this.plugin.settings.theme);
				d.onChange(async (value) => {
					this.plugin.settings.theme = value as ThemeMode;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				});
			});

		new Setting(containerEl)
			.setName("Default service")
			.setDesc("Which AI service opens when AI chat first loads.")
			.addDropdown((d) => {
				d.addOption("chatgpt",    "ChatGPT");
				d.addOption("claude",     "Claude");
				d.addOption("deepseek",   "DeepSeek");
				d.addOption("perplexity", "Perplexity");
				d.addOption("gemini",     "Gemini");
				d.addOption("grok",       "Grok");
				d.addOption("copilot",    "Copilot");
				d.addOption("manus",      "Manus AI");
				d.addOption("kimi",       "Kimi");
				d.setValue(this.plugin.settings.defaultService);
				d.onChange(async (value) => {
					const key = value as ServiceKey;
					this.plugin.settings.defaultService = key;
					this.plugin.settings.webAppUrl = SERVICE_URLS[key];
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				});
			});

		new Setting(containerEl)
			.setName("Open sidebar on startup")
			.setDesc("Restore the sidebar when Obsidian finishes loading.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.openOnStartup).onChange(async (v) => {
					this.plugin.settings.openOnStartup = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Browser").setHeading();

		new Setting(containerEl)
			.setName("Auto-refresh interval (minutes)")
			.setDesc(
				"Silently reload the AI page after this many minutes of inactivity. " +
				"Picks up new features and UI updates from the service. Set to 0 to disable.",
			)
			.addText((t) =>
				t
					.setPlaceholder(String(DEFAULT_SETTINGS.autoRefreshMinutes))
					.setValue(String(this.plugin.settings.autoRefreshMinutes))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed >= 0) {
							this.plugin.settings.autoRefreshMinutes = parsed;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						}
					}),
			);

		new Setting(containerEl).setName("Vault context").setHeading();

		new Setting(containerEl)
			.setName("Auto-clear context after send")
			.setDesc("Remove all context items automatically after clicking add.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoClearContext).onChange(async (v) => {
					this.plugin.settings.autoClearContext = v;
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
				}),
			);

		new Setting(containerEl)
			.setName("Context prefix")
			.setDesc(
				"Text prepended to every context send — e.g. a prompt instruction like " +
				"\"Here are my Obsidian notes:\". Leave blank to send notes as-is.",
			)
			.addTextArea((t) =>
				t
					.setPlaceholder("E.g. Here are my Obsidian notes, please help me with the following:")
					.setValue(this.plugin.settings.contextPrefix)
					.onChange(async (value) => {
						this.plugin.settings.contextPrefix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max context length")
			.setDesc(
				"Maximum number of characters included when sending vault notes as context. " +
				"Large values may exceed the AI's context window.",
			)
			.addText((t) =>
				t
					.setPlaceholder(String(DEFAULT_SETTINGS.maxContextLength))
					.setValue(String(this.plugin.settings.maxContextLength))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed > 0) {
							this.plugin.settings.maxContextLength = parsed;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Send selected text to AI")
			.setDesc(
				"Enable the 'Send selected text to AI' command. " +
				"When on, selecting text and running the command injects it directly into the active AI service.",
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.sendSelectionEnabled).onChange(async (v) => {
					this.plugin.settings.sendSelectionEnabled = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Auto-add active note on open")
			.setDesc("Automatically add the currently focused note to context when the sidebar opens.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoContextOnOpen).onChange(async (v) => {
					this.plugin.settings.autoContextOnOpen = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Strip frontmatter when sending context")
			.setDesc("Remove YAML frontmatter (the --- block) from notes before injecting them into the AI.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.stripFrontmatter).onChange(async (v) => {
					this.plugin.settings.stripFrontmatter = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Save AI response").setHeading();

		new Setting(containerEl)
			.setName("Save folder")
			.setDesc("Vault folder where notes created via the 'save response' button are stored.")
			.addText((t) =>
				t
					.setPlaceholder("AI notes")
					.setValue(this.plugin.settings.saveNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings.saveNoteFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Prompt templates").setHeading();

		new Setting(containerEl)
			.setName("Add template")
			.setDesc("Templates appear in the sidebar and inject a prompt into the active AI service with one click.")
			.addButton((btn) => {
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.promptTemplates.push({
						id: Date.now().toString(),
						label: "New template",
						text: "",
					});
					await this.plugin.saveSettings();
					this.display();
				});
			});

		for (const template of this.plugin.settings.promptTemplates) {
			const row = new Setting(containerEl)
				.addText((t) =>
					t
						.setPlaceholder("Label")
						.setValue(template.label)
						.onChange(async (v) => {
							template.label = v;
							await this.plugin.saveSettings();
						}),
				)
				.addTextArea((t) => {
					t.setPlaceholder("Prompt text…").setValue(template.text).onChange(async (v) => {
						template.text = v;
						await this.plugin.saveSettings();
					});
					t.inputEl.rows = 2;
					t.inputEl.addClass("vc-template-textarea");
					return t;
				})
				.addButton((btn) => {
					btn.setIcon("trash").setWarning().setTooltip("Delete template").onClick(async () => {
						this.plugin.settings.promptTemplates =
							this.plugin.settings.promptTemplates.filter((t) => t.id !== template.id);
						await this.plugin.saveSettings();
						this.display();
					});
				});
			row.settingEl.addClass("vc-template-row");
		}
	}
}
