import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import AIChatPlugin from "./main";
import { CHATGPT_URL, SERVICE_META, ServiceKey, SERVICE_URLS } from "./constants";
import { getServiceKey, normalizeUrl } from "./utils";

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

export interface CustomService {
	id: string;
	label: string;
	url: string;
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
	autoClearContext: boolean;
	contextPrefix: string;
	theme: ThemeMode;
	sendSelectionEnabled: boolean;
	promptTemplates: PromptTemplate[];
	autoContextOnOpen: boolean;
	stripFrontmatter: boolean;
	saveNoteFolder: string;
	useDateSubfolder: boolean;
	customServices: CustomService[];
	splitPanelUrl: string;
}

export const DEFAULT_SETTINGS: DockSettings = {
	webAppUrl:           CHATGPT_URL,
	openOnStartup:       true,
	maxContextLength:    50000,
	contextItems:        [],
	enableChatGPT:       true,
	enableClaude:        true,
	enableDeepSeek:      true,
	enablePerplexity:    true,
	enableGemini:        true,
	enableGrok:          true,
	enableCopilot:       true,
	enableManus:         true,
	enableKimi:          true,
	autoRefreshMinutes:  60,
	autoClearContext:    false,
	contextPrefix:       "",
	theme:               "auto",
	sendSelectionEnabled: true,
	promptTemplates: [
		{ id: "t1", label: "Summarize",   text: "Please summarize the following note concisely:\n\n" },
		{ id: "t2", label: "Fix grammar", text: "Please fix the grammar and spelling in the following text:\n\n" },
		{ id: "t3", label: "Expand idea", text: "Please expand on the following idea with more depth and detail:\n\n" },
	],
	autoContextOnOpen: false,
	stripFrontmatter:  false,
	saveNoteFolder:    "AI Notes",
	useDateSubfolder:  false,
	customServices:    [],
	splitPanelUrl:     SERVICE_URLS.claude,
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

		// ── AI Services ───────────────────────────────────────
		new Setting(containerEl).setName("AI services").setHeading();

		for (const svc of SERVICE_META) {
			new Setting(containerEl)
				.setName(svc.label)
				.setDesc("Show in the service selector.")
				.addToggle(t =>
					t.setValue(this.plugin.settings[svc.enableKey])
						.onChange(async v => {
							this.plugin.settings[svc.enableKey] = v;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						}),
				);
		}

		// ── General ───────────────────────────────────────────
		new Setting(containerEl).setName("Appearance & behaviour").setHeading();

		new Setting(containerEl)
			.setName("Theme")
			.setDesc("Header colour scheme — auto follows Obsidian.")
			.addDropdown(d => {
				d.addOption("auto",  "Auto");
				d.addOption("light", "Light");
				d.addOption("dark",  "Dark");
				d.setValue(this.plugin.settings.theme)
					.onChange(async v => {
						this.plugin.settings.theme = v as ThemeMode;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl)
			.setName("Default service")
			.setDesc("Which AI opens when the portal first loads.")
			.addDropdown(d => {
				for (const m of SERVICE_META) d.addOption(m.key, m.label);
				d.setValue(getServiceKey(this.plugin.settings.webAppUrl) ?? SERVICE_META[0].key)
					.onChange(async v => {
						this.plugin.settings.webAppUrl = SERVICE_URLS[v as ServiceKey];
						await this.plugin.saveSettings();
						this.plugin.updateStatusBar();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl)
			.setName("Open on startup")
			.setDesc("Restore the portal when Obsidian loads.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.openOnStartup)
					.onChange(async v => {
						this.plugin.settings.openOnStartup = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-refresh (minutes)")
			.setDesc("Silently reload after this many idle minutes. 0 = off.")
			.addText(t =>
				t.setPlaceholder(String(DEFAULT_SETTINGS.autoRefreshMinutes))
					.setValue(String(this.plugin.settings.autoRefreshMinutes))
					.onChange(async v => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n >= 0) {
							this.plugin.settings.autoRefreshMinutes = n;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Open split panel")
			.setDesc("Open a second portal panel — each remembers its own service.")
			.addButton(btn =>
				btn.setButtonText("Open").onClick(() => void this.plugin.openSplitPanel()),
			);

		// ── Context & Notes ───────────────────────────────────
		new Setting(containerEl).setName("Context & notes").setHeading();

		new Setting(containerEl)
			.setName("Send selected text to AI")
			.setDesc("Enable injecting editor selections into the active AI service.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.sendSelectionEnabled)
					.onChange(async v => {
						this.plugin.settings.sendSelectionEnabled = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-add active note on open")
			.setDesc("Add the current note to context when the portal opens.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.autoContextOnOpen)
					.onChange(async v => {
						this.plugin.settings.autoContextOnOpen = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Strip frontmatter")
			.setDesc("Remove the YAML --- block from notes before sending as context.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.stripFrontmatter)
					.onChange(async v => {
						this.plugin.settings.stripFrontmatter = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-clear context after send")
			.setDesc("Clear all context items after clicking add.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.autoClearContext)
					.onChange(async v => {
						this.plugin.settings.autoClearContext = v;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

		new Setting(containerEl)
			.setName("Context prefix")
			.setDesc("Text prepended to every context send. Leave blank to send notes as-is.")
			.addTextArea(t =>
				t.setPlaceholder("E.g. Here are my notes, please help me:")
					.setValue(this.plugin.settings.contextPrefix)
					.onChange(async v => {
						this.plugin.settings.contextPrefix = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max context length")
			.setDesc("Character limit for context sent to AI.")
			.addText(t =>
				t.setPlaceholder(String(DEFAULT_SETTINGS.maxContextLength))
					.setValue(String(this.plugin.settings.maxContextLength))
					.onChange(async v => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n > 0) {
							this.plugin.settings.maxContextLength = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Save folder")
			.setDesc("Vault folder for notes created via the save buttons.")
			.addText(t =>
				t.setPlaceholder("AI notes")
					.setValue(this.plugin.settings.saveNoteFolder)
					.onChange(async v => {
						this.plugin.settings.saveNoteFolder = v;
						await this.plugin.saveSettings();
					}),
			)
			.addButton(btn =>
				btn.setButtonText("Open folder").setTooltip("Reveal in file explorer").onClick(() => {
					const folderPath = this.plugin.settings.saveNoteFolder.trim() || "AI Notes";
					const abstract   = this.app.vault.getAbstractFileByPath(folderPath);
					if (!abstract) { new Notice(`Folder "${folderPath}" does not exist yet — save a note first.`); return; }
					const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
					if (explorer) {
						void this.app.workspace.revealLeaf(explorer);
						const view = explorer.view as unknown as { revealInFolder?: (f: unknown) => void };
						view.revealInFolder?.(abstract);
					}
				}),
			);

		new Setting(containerEl)
			.setName("Organise saves by date")
			.setDesc("Save into daily subfolders — e.g. AI notes/2026-06-01/response.md.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.useDateSubfolder)
					.onChange(async v => {
						this.plugin.settings.useDateSubfolder = v;
						await this.plugin.saveSettings();
					}),
			);

		// ── Custom services ───────────────────────────────────
		new Setting(containerEl).setName("Custom services").setHeading();

		new Setting(containerEl)
			.setName("Add custom service")
			.setDesc("Add any AI tool by URL — it appears in the service selector.")
			.addButton(btn =>
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.customServices.push({ id: Date.now().toString(), label: "My AI tool", url: "https://" });
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
					this.display();
				}),
			);

		for (const svc of this.plugin.settings.customServices) {
			const row = new Setting(containerEl)
				.addText(t =>
					t.setPlaceholder("Label").setValue(svc.label)
						.onChange(async v => { svc.label = v; await this.plugin.saveSettings(); this.plugin.rerenderOpenViews(); }),
				)
				.addText(t => {
					t.setPlaceholder("Enter URL…").setValue(svc.url)
						.onChange(async v => { svc.url = normalizeUrl(v); await this.plugin.saveSettings(); this.plugin.rerenderOpenViews(); });
					t.inputEl.addClass("vc-custom-svc-url");
					return t;
				})
				.addButton(btn =>
					btn.setIcon("trash").setWarning().setTooltip("Remove").onClick(async () => {
						this.plugin.settings.customServices = this.plugin.settings.customServices.filter(s => s.id !== svc.id);
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
						this.display();
					}),
				);
			row.settingEl.addClass("vc-custom-svc-row");
		}

		// ── Prompt templates ──────────────────────────────────
		new Setting(containerEl).setName("Prompt templates").setHeading();

		new Setting(containerEl)
			.setName("Add template")
			.setDesc("One-click prompts that inject text into the active AI service.")
			.addButton(btn =>
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.promptTemplates.push({ id: Date.now().toString(), label: "New template", text: "" });
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		for (const tmpl of this.plugin.settings.promptTemplates) {
			const row = new Setting(containerEl)
				.addText(t =>
					t.setPlaceholder("Label").setValue(tmpl.label)
						.onChange(async v => { tmpl.label = v; await this.plugin.saveSettings(); }),
				)
				.addTextArea(t => {
					t.setPlaceholder("Prompt text…").setValue(tmpl.text)
						.onChange(async v => { tmpl.text = v; await this.plugin.saveSettings(); });
					t.inputEl.rows = 2;
					t.inputEl.addClass("vc-template-textarea");
					return t;
				})
				.addButton(btn =>
					btn.setIcon("trash").setWarning().setTooltip("Delete").onClick(async () => {
						this.plugin.settings.promptTemplates = this.plugin.settings.promptTemplates.filter(t => t.id !== tmpl.id);
						await this.plugin.saveSettings();
						this.display();
					}),
				);
			row.settingEl.addClass("vc-template-row");
		}
	}
}
