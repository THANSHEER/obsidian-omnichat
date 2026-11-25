import { App, Notice, PluginSettingTab, sanitizeHTMLToDom, Setting, type SettingDefinitionItem } from "obsidian";
import type AIChatPlugin from "./main";
import { CHATGPT_URL, SERVICE_META, ServiceKey, SERVICE_URLS } from "./constants";
import { FeatureRequestModal } from "./modals/FeatureRequestModal";
import { FeedbackModal } from "./modals/FeedbackModal";
import { GitHubIssueModal } from "./modals/GitHubIssueModal";
import { renderSiblingPluginsSection } from "./modals/siblingPlugins";
import { getCleanUserAgent, getServiceKey, normalizeUrl } from "./utils";
import { AGENT_ENGINES, type AgentEngineKey, type UIMode } from "./types/agent";
import { detectCli, findExecutable, isDesktopNodeAvailable, getCliWorkingDirectory } from "./services/AgentCliService";
import { SUPPORTED_LOCALES, setLocale, t } from "./i18n";

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

export type SettingsTabSection = "common" | "browser" | "agent_gui" | "diagnostics";

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
	enableOllama: boolean;
	ollamaApiUrl: string;
	autoRefreshMinutes: number;
	autoClearContext: boolean;
	contextPrefix: string;
	language: string;
	theme: ThemeMode;
	adaptWebviewTheme: boolean;
	sendSelectionEnabled: boolean;
	promptTemplates: PromptTemplate[];
	autoContextOnOpen: boolean;
	stripFrontmatter: boolean;
	saveNoteFolder: string;
	useDateSubfolder: boolean;
	formatAIResponse: boolean;
	customServices: CustomService[];
	splitPanelUrl: string;
	/** Custom User-Agent string override for webview and Electron session. */
	customUserAgent: string;
	/** Last plugin version the user has run — used for first-install welcome and update changelog. */
	lastSeenVersion: string;

	// ── Dual Mode & Agent Settings ───────────────────────────
	defaultMode: UIMode;
	splitPanelMode: UIMode;
	agentEngine: AgentEngineKey;
	claudeCliPath: string;
	antigravityCliPath: string;
	codexCliPath: string;
	customCliCommand: string;
	cliWorkingDirectory: string;
	useVaultAsCliCwd: boolean;
	dangerouslySkipPermissions: boolean;
	cliCustomArgs: string;
	cliEnvironmentVariables: string;
	anthropicApiKey: string;
	anthropicModel: string;
	openaiApiKey: string;
	openaiBaseUrl: string;
	openaiModel: string;
	showThoughts: boolean;
	autoScrollChat: boolean;
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
	enableOllama:        true,
	ollamaApiUrl:        "http://127.0.0.1:11434",
	autoRefreshMinutes:  60,
	autoClearContext:    false,
	contextPrefix:       "",
	language:            "auto",
	theme:               "auto",
	adaptWebviewTheme:   true,
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
	formatAIResponse:  true,
	customServices:    [],
	splitPanelUrl:     SERVICE_URLS.claude,
	customUserAgent:   "",
	lastSeenVersion:   "",

	// Dual Mode defaults
	defaultMode:        "browser",
	splitPanelMode:     "agent",
	agentEngine:        "claude-cli",
	claudeCliPath:      "",
	antigravityCliPath: "",
	codexCliPath:       "",
	customCliCommand:   "",
	cliWorkingDirectory: "",
	useVaultAsCliCwd:   true,
	dangerouslySkipPermissions: false,
	cliCustomArgs:      "",
	cliEnvironmentVariables: "",
	anthropicApiKey:    "",
	anthropicModel:     "claude-3-7-sonnet-latest",
	openaiApiKey:       "",
	openaiBaseUrl:      "https://api.openai.com/v1",
	openaiModel:        "gpt-4o",
	showThoughts:       true,
	autoScrollChat:     true,
};

export class AIChatSettingTab extends PluginSettingTab {
	plugin: AIChatPlugin;
	public activeTab: SettingsTabSection = "common";
	private diagnosticsReport: HTMLElement | null = null;

	constructor(app: App, plugin: AIChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	display(): void {
		this.renderSettings();
	}

	renderSettings(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Settings Navigation Tabs ─────────────────────────
		const navEl = containerEl.createDiv({ cls: "oc-settings-nav" });

		const tabs: { key: SettingsTabSection; label: string; icon: string }[] = [
			{ key: "common",      label: t("settings.tab.general"),  icon: "settings" },
			{ key: "browser",     label: t("settings.tab.browser"),  icon: "globe" },
			{ key: "agent_gui",   label: t("settings.tab.agent"),    icon: "terminal" },
			{ key: "diagnostics", label: "Diagnostics & help",       icon: "activity" },
		];

		for (const tab of tabs) {
			const btn = navEl.createEl("button", {
				cls: `oc-settings-tab-btn ${this.activeTab === tab.key ? "is-active mod-cta" : ""}`,
				text: tab.label,
			});
			btn.addEventListener("click", () => {
				this.activeTab = tab.key;
				this.renderSettings();
			});
		}

		// Render the active section
		switch (this.activeTab) {
			case "common":
				this.renderCommonSection(containerEl);
				break;
			case "browser":
				this.renderBrowserSection(containerEl);
				break;
			case "agent_gui":
				this.renderAgentSection(containerEl);
				break;
			case "diagnostics":
				this.renderDiagnosticsSection(containerEl);
				break;
		}
	}

	// ═══════════════════════════════════════════════════════════
	// ── PART 1: COMMON & GENERAL SETTINGS ─────────────────────
	// ═══════════════════════════════════════════════════════════
	private renderCommonSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Interface & modes").setHeading();

		new Setting(containerEl)
			.setName(t("settings.general.language"))
			.setDesc(t("settings.general.languageDesc"))
			.addDropdown(d => {
				d.addOption("auto", t("settings.general.languageAuto"));
				for (const loc of SUPPORTED_LOCALES) {
					d.addOption(loc.code, loc.nativeLabel);
				}
				d.setValue(this.plugin.settings.language || "auto")
					.onChange(async v => {
						this.plugin.settings.language = v;
						setLocale(v);
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
						this.renderSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("settings.general.defaultMode"))
			.setDesc(t("settings.general.defaultModeDesc"))
			.addDropdown(d => {
				d.addOption("browser", "Browser AI (web embedding)");
				d.addOption("agent", "Agent CLI & API (coding GUI)");
				d.setValue(this.plugin.settings.defaultMode)
					.onChange(async v => {
						this.plugin.settings.defaultMode = v as UIMode;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl).setName("Split panel").setHeading();

		new Setting(containerEl)
			.setName(t("settings.general.openSplit"))
			.setDesc(t("settings.general.openSplitDesc"))
			.addButton(btn =>
				btn.setButtonText("Open panel").onClick(() => void this.plugin.openSplitPanel()),
			);

		new Setting(containerEl)
			.setName("Default split panel mode")
			.setDesc("Mode for the split panel when first opened.")
			.addDropdown(d => {
				d.addOption("browser", "Browser AI");
				d.addOption("agent", "Agent CLI & API GUI");
				d.setValue(this.plugin.settings.splitPanelMode)
					.onChange(async v => {
						this.plugin.settings.splitPanelMode = v as UIMode;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl).setName(t("settings.context.heading")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.context.sendSelection"))
			.setDesc(t("settings.context.sendSelectionDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.sendSelectionEnabled)
					.onChange(async v => {
						this.plugin.settings.sendSelectionEnabled = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.context.autoAdd"))
			.setDesc(t("settings.context.autoAddDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.autoContextOnOpen)
					.onChange(async v => {
						this.plugin.settings.autoContextOnOpen = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.context.stripFrontmatter"))
			.setDesc(t("settings.context.stripFrontmatterDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.stripFrontmatter)
					.onChange(async v => {
						this.plugin.settings.stripFrontmatter = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.context.autoClear"))
			.setDesc(t("settings.context.autoClearDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.autoClearContext)
					.onChange(async v => {
						this.plugin.settings.autoClearContext = v;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.context.prefix"))
			.setDesc(t("settings.context.prefixDesc"))
			.addTextArea(ta =>
				ta.setPlaceholder(t("settings.context.prefixPlaceholder"))
					.setValue(this.plugin.settings.contextPrefix)
					.onChange(async v => {
						this.plugin.settings.contextPrefix = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.context.maxLength"))
			.setDesc(t("settings.context.maxLengthDesc"))
			.addText(txt =>
				txt.setPlaceholder(String(DEFAULT_SETTINGS.maxContextLength))
					.setValue(String(this.plugin.settings.maxContextLength))
					.onChange(async v => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n > 0) {
							this.plugin.settings.maxContextLength = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		// Prompt Templates
		new Setting(containerEl).setName("Prompt templates").setHeading();

		new Setting(containerEl)
			.setName("Add template")
			.setDesc("Quick prompts with variable tags: {{selection}}, {{title}}, {{path}}, {{tags}}, {{date}}.")
			.addButton(btn =>
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.promptTemplates.push({ id: Date.now().toString(), label: "New template", text: "" });
					await this.plugin.saveSettings();
					this.renderSettings();
				}),
			);

		for (const tmpl of this.plugin.settings.promptTemplates) {
			const titleRow = new Setting(containerEl)
				.setName(tmpl.label || "Template")
				.addText(t =>
					t.setPlaceholder("Title").setValue(tmpl.label)
						.onChange(async v => { tmpl.label = v; await this.plugin.saveSettings(); }),
				)
				.addExtraButton(btn =>
					btn.setIcon("trash").setTooltip("Delete template").onClick(async () => {
						this.plugin.settings.promptTemplates = this.plugin.settings.promptTemplates.filter(t => t.id !== tmpl.id);
						await this.plugin.saveSettings();
						this.renderSettings();
					}),
				);
			titleRow.settingEl.addClass("vc-template-title-row");

			const promptRow = new Setting(containerEl)
				.addTextArea(t => {
					t.setPlaceholder("Prompt text…").setValue(tmpl.text)
						.onChange(async v => { tmpl.text = v; await this.plugin.saveSettings(); });
					t.inputEl.rows = 3;
					t.inputEl.addClass("vc-template-textarea");
					return t;
				});
			promptRow.settingEl.addClass("vc-template-prompt-row");
		}

		// Save responses to vault
		new Setting(containerEl).setName("Vault saving & formatting").setHeading();

		new Setting(containerEl)
			.setName("Save folder")
			.setDesc("Vault folder where notes created via the save button are stored.")
			.addText(t =>
				t.setPlaceholder("AI notes")
					.setValue(this.plugin.settings.saveNoteFolder)
					.onChange(async v => {
						this.plugin.settings.saveNoteFolder = v;
						await this.plugin.saveSettings();
					}),
			)
			.addButton(btn =>
				btn.setButtonText("Open folder").onClick(() => {
					const folderPath = this.plugin.settings.saveNoteFolder.trim() || "AI notes";
					const abstract = this.app.vault.getAbstractFileByPath(folderPath);
					if (!abstract) { new Notice(`Folder "${folderPath}" does not exist yet.`); return; }
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
			.setDesc("Save into daily subfolders (e.g. AI notes/2026-09-27/response.md).")
			.addToggle(t =>
				t.setValue(this.plugin.settings.useDateSubfolder)
					.onChange(async v => {
						this.plugin.settings.useDateSubfolder = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-format AI response")
			.setDesc("Reconstruct tables and code blocks when saving AI responses to your vault.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.formatAIResponse)
					.onChange(async v => {
						this.plugin.settings.formatAIResponse = v;
						await this.plugin.saveSettings();
					}),
			);

		// Appearance & Startup
		new Setting(containerEl).setName("Appearance & startup").setHeading();

		new Setting(containerEl)
			.setName(t("settings.general.theme"))
			.setDesc(t("settings.general.themeDesc"))
			.addDropdown(d => {
				d.addOption("auto",  t("common.auto"));
				d.addOption("light", t("common.light"));
				d.addOption("dark",  t("common.dark"));
				d.setValue(this.plugin.settings.theme)
					.onChange(async v => {
						this.plugin.settings.theme = v as ThemeMode;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl)
			.setName(t("settings.general.openOnStartup"))
			.setDesc(t("settings.general.openOnStartupDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.openOnStartup)
					.onChange(async v => {
						this.plugin.settings.openOnStartup = v;
						await this.plugin.saveSettings();
					}),
			);
	}

	// ═══════════════════════════════════════════════════════════
	// ── PART 2: DEDICATED BROWSER AI SETTINGS ─────────────────
	// ═══════════════════════════════════════════════════════════
	private renderBrowserSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.browser.servicesHeading")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.browser.adaptTheme"))
			.setDesc(t("settings.browser.adaptThemeDesc"))
			.addToggle(tg =>
				tg.setValue(this.plugin.settings.adaptWebviewTheme)
					.onChange(async v => {
						this.plugin.settings.adaptWebviewTheme = v;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.general.defaultService"))
			.setDesc(t("settings.general.defaultServiceDesc"))
			.addDropdown(d => {
				for (const m of SERVICE_META) d.addOption(m.key, m.label);
				d.setValue(getServiceKey(this.plugin.settings.webAppUrl) ?? SERVICE_META[0].key)
					.onChange(async v => {
						this.plugin.settings.webAppUrl = SERVICE_URLS[v as ServiceKey];
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		new Setting(containerEl)
			.setName("Default split panel service")
			.setDesc("Which web AI opens in the split panel in browser mode.")
			.addDropdown(d => {
				for (const m of SERVICE_META) d.addOption(m.key, m.label);
				d.setValue(getServiceKey(this.plugin.settings.splitPanelUrl) ?? SERVICE_META[0].key)
					.onChange(async v => {
						this.plugin.settings.splitPanelUrl = SERVICE_URLS[v as ServiceKey];
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		for (const svc of SERVICE_META) {
			new Setting(containerEl)
				.setName(svc.label)
				.setDesc("Show in the browser service selector.")
				.addToggle(t =>
					t.setValue(this.plugin.settings[svc.enableKey])
						.onChange(async v => {
							this.plugin.settings[svc.enableKey] = v;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						}),
				);
		}

		// Custom Services
		new Setting(containerEl).setName("Custom web services").setHeading();

		new Setting(containerEl)
			.setName("Add custom service")
			.setDesc("Embed any web AI or app URL in the browser portal.")
			.addButton(btn =>
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.customServices.push({ id: Date.now().toString(), label: "My AI tool", url: "https://" });
					await this.plugin.saveSettings();
					this.plugin.rerenderOpenViews();
					this.renderSettings();
				}),
			);

		for (const svc of this.plugin.settings.customServices) {
			const row = new Setting(containerEl)
				.addText(t =>
					t.setPlaceholder("Label").setValue(svc.label)
						.onChange(async v => { svc.label = v; await this.plugin.saveSettings(); this.plugin.rerenderOpenViews(); }),
				)
				.addText(t => {
					t.setPlaceholder("URL").setValue(svc.url)
						.onChange(async v => {
							const normalized = normalizeUrl(v);
							svc.url = normalized;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						});
					t.inputEl.addClass("vc-custom-svc-url");
					return t;
				})
				.addButton(btn => {
					btn.buttonEl.addClass("mod-warning");
					btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
						this.plugin.settings.customServices = this.plugin.settings.customServices.filter(s => s.id !== svc.id);
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
						this.renderSettings();
					});
				});
			row.settingEl.addClass("vc-custom-svc-row");
		}

		// Browser Emulation & Session
		new Setting(containerEl).setName("Browser emulation & session").setHeading();

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
			.setName("Custom user-agent")
			.setDesc("Overrides the browser user-agent string. Leave blank for Chrome desktop emulation.")
			.addText(t => {
				t.setPlaceholder(getCleanUserAgent())
					.setValue(this.plugin.settings.customUserAgent)
					.onChange(async v => {
						this.plugin.settings.customUserAgent = v.trim();
						await this.plugin.saveSettings();
						this.plugin.reconfigureBrowserSession();
						this.plugin.rerenderOpenViews();
					});
				t.inputEl.addClass("vc-custom-ua-input");
				return t;
			})
			.addButton(btn => {
				btn.setButtonText("Reset to Chrome").onClick(async () => {
					this.plugin.settings.customUserAgent = "";
					await this.plugin.saveSettings();
					this.plugin.reconfigureBrowserSession();
					this.plugin.rerenderOpenViews();
					this.renderSettings();
					new Notice("User-agent reset to default Chrome.");
				});
			});

		new Setting(containerEl)
			.setName("Clear AI browser data")
			.setDesc("Clears cookies, cache, and session storage for embedded AI web sessions.")
			.addButton(btn => {
				btn.setButtonText("Clear cache & cookies");
				btn.buttonEl.addClass("mod-warning");
				btn.onClick(async () => {
					const cleared = await this.plugin.clearBrowserSession();
					if (cleared) {
						new Notice("AI browser cache & cookies cleared.");
						this.plugin.rerenderOpenViews();
					} else {
						new Notice("Could not clear browser session in this environment.");
					}
				});
			});
	}

	// ═══════════════════════════════════════════════════════════
	// ── PART 3: DEDICATED AGENT CLI & API SETTINGS ────────────
	// ═══════════════════════════════════════════════════════════
	private renderAgentSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Active agent engine").setHeading();

		new Setting(containerEl)
			.setName("Default agent engine")
			.setDesc("Which CLI or API engine powers the native agent studio.")
			.addDropdown(d => {
				for (const eng of AGENT_ENGINES) {
					d.addOption(eng.key, `${eng.label} (${eng.badge})`);
				}
				d.setValue(this.plugin.settings.agentEngine)
					.onChange(async v => {
						this.plugin.settings.agentEngine = v as AgentEngineKey;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					});
			});

		// CLI Configurations
		new Setting(containerEl).setName("CLI engine configuration").setHeading();

		new Setting(containerEl)
			.setName("Auto-detect CLI paths")
			.setDesc("Automatically scan your system for Claude Code, Antigravity, and Codex CLI executables.")
			.addButton(btn =>
				btn.setButtonText("Scan & auto-detect").setCta().onClick(async () => {
					btn.setButtonText("Scanning…");
					btn.setDisabled(true);

					const claudeRes = await detectCli("claude", this.plugin.settings.claudeCliPath);
					const agyRes = await detectCli("agy", this.plugin.settings.antigravityCliPath);
					const codexRes = await detectCli("codex", this.plugin.settings.codexCliPath);

					if (claudeRes.found && !this.plugin.settings.claudeCliPath) {
						this.plugin.settings.claudeCliPath = claudeRes.path;
					}
					if (agyRes.found && !this.plugin.settings.antigravityCliPath) {
						this.plugin.settings.antigravityCliPath = agyRes.path;
					}
					if (codexRes.found && !this.plugin.settings.codexCliPath) {
						this.plugin.settings.codexCliPath = codexRes.path;
					}

					await this.plugin.saveSettings();
					btn.setButtonText("Scan & auto-detect");
					btn.setDisabled(false);
					this.renderSettings();

					new Notice(
						`Scan complete: Claude (${claudeRes.found ? "Found" : "Missing"}), Antigravity (${agyRes.found ? "Found" : "Missing"}), Codex (${codexRes.found ? "Found" : "Missing"})`,
					);
				}),
			);

		new Setting(containerEl)
			.setName("Claude Code CLI path")
			.setDesc("Path to Claude binary. Leave blank to auto-detect from path.")
			.addText(t =>
				t.setPlaceholder(findExecutable("claude") || "claude")
					.setValue(this.plugin.settings.claudeCliPath)
					.onChange(async v => {
						this.plugin.settings.claudeCliPath = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Antigravity CLI path")
			.setDesc("Path to agy binary. Leave blank to auto-detect from path.")
			.addText(t =>
				t.setPlaceholder(findExecutable("agy") || "agy")
					.setValue(this.plugin.settings.antigravityCliPath)
					.onChange(async v => {
						this.plugin.settings.antigravityCliPath = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI Codex CLI path")
			.setDesc("Path to Codex or opencode executable.")
			.addText(t =>
				t.setPlaceholder("Codex")
					.setValue(this.plugin.settings.codexCliPath)
					.onChange(async v => {
						this.plugin.settings.codexCliPath = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Custom CLI command")
			.setDesc("Command string used when the custom agent CLI engine is selected.")
			.addText(t =>
				t.setPlaceholder("Enter command…")
					.setValue(this.plugin.settings.customCliCommand)
					.onChange(async v => {
						this.plugin.settings.customCliCommand = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Use vault as working directory")
			.setDesc("Run the CLI in the root of your Obsidian vault so agents can read and write notes directly.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.useVaultAsCliCwd)
					.onChange(async v => {
						this.plugin.settings.useVaultAsCliCwd = v;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
						this.renderSettings();
					}),
			);

		if (!this.plugin.settings.useVaultAsCliCwd) {
			new Setting(containerEl)
				.setName("Custom working directory")
				.setDesc("Absolute path to the working directory for CLI executions.")
				.addText(t =>
					t.setPlaceholder("Enter directory path…")
						.setValue(this.plugin.settings.cliWorkingDirectory)
						.onChange(async v => {
							this.plugin.settings.cliWorkingDirectory = v.trim();
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						}),
				);
		}

		new Setting(containerEl)
			.setName("Auto-approve tool permissions")
			.setDesc("Pass --dangerously-skip-permissions to CLI agents for autonomous tool execution.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.dangerouslySkipPermissions)
					.onChange(async v => {
						this.plugin.settings.dangerouslySkipPermissions = v;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

		new Setting(containerEl)
			.setName("Custom CLI arguments")
			.setDesc("Extra arguments passed to the CLI process.")
			.addText(t =>
				t.setPlaceholder("Enter arguments…")
					.setValue(this.plugin.settings.cliCustomArgs)
					.onChange(async v => {
						this.plugin.settings.cliCustomArgs = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("CLI environment variables")
			.setDesc("Additional environment variables injected into the process (one key=value per line).")
			.addTextArea(t =>
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				t.setPlaceholder("ANTHROPIC_API_KEY=sk-...\nOPENAI_API_KEY=sk-...")
					.setValue(this.plugin.settings.cliEnvironmentVariables)
					.onChange(async v => {
						this.plugin.settings.cliEnvironmentVariables = v;
						await this.plugin.saveSettings();
					}),
			);

		// Direct API Providers
		new Setting(containerEl).setName("Direct API providers").setHeading();

		new Setting(containerEl)
			.setName("Anthropic API key")
			.setDesc("API key for direct streaming with Claude 3.7 / 3.5 Sonnet.")
			.addText(t => {
				t.setPlaceholder("Enter API key…")
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async v => {
						this.plugin.settings.anthropicApiKey = v.trim();
						await this.plugin.saveSettings();
					});
				t.inputEl.type = "password";
				return t;
			});

		new Setting(containerEl)
			.setName("Anthropic model")
			.setDesc("Model identifier for Anthropic API.")
			.addText(t =>
				t.setPlaceholder("Enter model name…")
					.setValue(this.plugin.settings.anthropicModel)
					.onChange(async v => {
						this.plugin.settings.anthropicModel = v.trim() || "claude-3-7-sonnet-latest";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI API key")
			.setDesc("API key for OpenAI GPT-4o, Codex or compatible endpoint.")
			.addText(t => {
				t.setPlaceholder("Enter API key…")
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async v => {
						this.plugin.settings.openaiApiKey = v.trim();
						await this.plugin.saveSettings();
					});
				t.inputEl.type = "password";
				return t;
			});

		new Setting(containerEl)
			.setName("OpenAI base URL")
			.setDesc("Base URL for OpenAI or compatible endpoints (e.g. DeepSeek, Groq, LM Studio).")
			.addText(t =>
				t.setPlaceholder("Enter base URL…")
					.setValue(this.plugin.settings.openaiBaseUrl)
					.onChange(async v => {
						this.plugin.settings.openaiBaseUrl = v.trim() || "https://api.openai.com/v1";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI model")
			.setDesc("Model identifier for OpenAI API.")
			.addText(t =>
				t.setPlaceholder("Enter model name…")
					.setValue(this.plugin.settings.openaiModel)
					.onChange(async v => {
						this.plugin.settings.openaiModel = v.trim() || "gpt-4o";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ollama API URL")
			.setDesc("Base URL for your local or remote Ollama instance (default: http://127.0.0.1:11434).")
			.addText(t =>
				t.setPlaceholder("Enter Ollama URL…")
					.setValue(this.plugin.settings.ollamaApiUrl)
					.onChange(async v => {
						this.plugin.settings.ollamaApiUrl = v.trim() || "http://127.0.0.1:11434";
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

		// Agent GUI Experience
		new Setting(containerEl).setName("Agent GUI display & experience").setHeading();

		new Setting(containerEl)
			.setName("Show reasoning & thoughts")
			.setDesc("Display collapsible reasoning thought blocks from thinking models and CLI agents.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.showThoughts)
					.onChange(async v => {
						this.plugin.settings.showThoughts = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-scroll chat")
			.setDesc("Automatically scroll down as new tokens and responses stream in.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.autoScrollChat)
					.onChange(async v => {
						this.plugin.settings.autoScrollChat = v;
						await this.plugin.saveSettings();
					}),
			);
	}

	// ═══════════════════════════════════════════════════════════
	// ── PART 4: DIAGNOSTICS & HELP ────────────────────────────
	// ═══════════════════════════════════════════════════════════
	private renderDiagnosticsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("System & CLI health check").setHeading();

		new Setting(containerEl)
			.setName("Run diagnostics")
			.setDesc("Verify Node.js runtime, CLI installations, paths, and environment.")
			.addButton(btn =>
				btn.setButtonText("Run diagnostics").setCta().onClick(async () => {
					btn.setButtonText("Testing…");
					btn.setDisabled(true);
					await this.executeDiagnostics();
					btn.setButtonText("Re-run diagnostics");
					btn.setDisabled(false);
				}),
			);

		this.diagnosticsReport = containerEl.createDiv({ cls: "oc-diagnostics-report" });
		void this.executeDiagnostics();

		// Support Banner
		new Setting(containerEl).setName("Support & community").setHeading();
		this.renderSupportBanner(containerEl);

		// Other plugins from creator
		renderSiblingPluginsSection(containerEl);
	}

	private async executeDiagnostics(): Promise<void> {
		if (!this.diagnosticsReport) return;
		this.diagnosticsReport.empty();

		const card = this.diagnosticsReport.createDiv({ cls: "oc-diag-card" });
		const title = card.createDiv({ cls: "oc-diag-header" });
		title.createDiv({ cls: "oc-diag-title", text: "OmniChat environment diagnostics" });

		const list = card.createEl("ul", { cls: "oc-diag-list" });

		// Node runtime
		const nodeAvail = isDesktopNodeAvailable();
		const nodeItem = list.createEl("li");
		nodeItem.createSpan({ cls: `oc-diag-badge ${nodeAvail ? "is-ok" : "is-error"}`, text: nodeAvail ? "PASS" : "FAIL" });
		nodeItem.createSpan({ text: ` Desktop Node environment: ${nodeAvail ? "Available (Electron)" : "Not available (Mobile or Sandbox)"}` });

		// Vault root
		const vaultPath = getCliWorkingDirectory(this.app, this.plugin.settings);
		const vaultItem = list.createEl("li");
		vaultItem.createSpan({ cls: "oc-diag-badge is-ok", text: "INFO" });
		vaultItem.createSpan({ text: ` Vault root working directory: ${vaultPath || "In-memory adapter"}` });

		// Claude CLI
		const claudeRes = await detectCli("claude", this.plugin.settings.claudeCliPath);
		const claudeItem = list.createEl("li");
		claudeItem.createSpan({ cls: `oc-diag-badge ${claudeRes.found ? "is-ok" : "is-warning"}`, text: claudeRes.found ? "PASS" : "MISSING" });
		claudeItem.createSpan({ text: ` Claude Code CLI: ${claudeRes.found ? `Found at ${claudeRes.path} (${claudeRes.version ?? ""})` : claudeRes.error ?? "Not found"}` });

		// Antigravity CLI
		const agyRes = await detectCli("agy", this.plugin.settings.antigravityCliPath);
		const agyItem = list.createEl("li");
		agyItem.createSpan({ cls: `oc-diag-badge ${agyRes.found ? "is-ok" : "is-warning"}`, text: agyRes.found ? "PASS" : "MISSING" });
		agyItem.createSpan({ text: ` Antigravity CLI: ${agyRes.found ? `Found at ${agyRes.path} (${agyRes.version ?? ""})` : agyRes.error ?? "Not found"}` });

		// Codex CLI
		const codexRes = await detectCli("codex", this.plugin.settings.codexCliPath);
		const codexItem = list.createEl("li");
		codexItem.createSpan({ cls: `oc-diag-badge ${codexRes.found ? "is-ok" : "is-muted"}`, text: codexRes.found ? "PASS" : "OPTIONAL" });
		codexItem.createSpan({ text: ` OpenAI Codex CLI: ${codexRes.found ? `Found at ${codexRes.path} (${codexRes.version ?? ""})` : "Optional — not found"}` });
	}

	private renderSupportBanner(containerEl: HTMLElement): void {
		const funding = (this.plugin.manifest as unknown as { fundingUrl?: string | Record<string, string> })?.fundingUrl;
		const kofiUrl = typeof funding === "object" && funding !== null
			? Object.entries(funding).find(([k]) => k.toLowerCase().includes("coffee") || k.toLowerCase().includes("ko-fi") || k.toLowerCase().includes("kofi"))?.[1]
			: typeof funding === "string" ? funding : undefined;
		const githubUrl = typeof funding === "object" && funding !== null
			? Object.entries(funding).find(([k]) => k.toLowerCase().includes("github") || k.toLowerCase().includes("sponsor"))?.[1]
			: undefined;

		const bannerEl = containerEl.createDiv({ cls: "oc-support-banner" });

		const KOFI_SVG = `<svg width="24" height="24" viewBox="0 0 241 194" fill="none" xmlns="http://www.w3.org/2000/svg" class="oc-kofi-icon" aria-hidden="true">
			<path d="M96.1344 193.911C61.1312 193.911 32.6597 178.256 15.9721 149.829C1.19788 124.912 -0.00585938 97.9229 -0.00585938 67.7662C-0.00585938 49.8876 5.37293 34.3215 15.5413 22.7466C24.8861 12.1157 38.1271 5.22907 52.8317 3.35378C70.2858 1.14271 91.9848 0.958984 114.545 0.958984C151.259 0.958984 161.63 1.4088 176.075 2.85328C195.29 4.76026 211.458 11.932 222.824 23.5955C234.368 35.4428 240.469 51.2624 240.469 69.3627V72.9994C240.469 103.885 219.821 129.733 191.046 136.759C188.898 141.827 186.237 146.871 183.089 151.837L183.006 151.964C172.869 167.632 149.042 193.918 103.401 193.918H96.1281L96.1344 193.911Z" fill="#FF5A16"/>
		</svg>`;

		const GITHUB_SVG = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<path d="M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 008 13.393a20.561 20.561 0 003.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 01-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5z"/>
		</svg>`;

		const btnsEl = bannerEl.createDiv({ cls: "oc-support-banner-btns" });

		if (kofiUrl) {
			const kofiBtn = btnsEl.createEl("a", {
				cls: "oc-support-banner-btn oc-support-kofi-btn",
				href: kofiUrl,
				attr: { target: "_blank", rel: "noopener noreferrer", "aria-label": "Support on Ko-fi" },
			});
			kofiBtn.appendChild(sanitizeHTMLToDom(KOFI_SVG));
			kofiBtn.createSpan({ text: "Support the project" });
			kofiBtn.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(kofiUrl, "_blank");
			});
		}

		if (githubUrl) {
			const ghBtn = btnsEl.createEl("a", {
				cls: "oc-support-banner-btn oc-support-github-btn",
				href: githubUrl,
				attr: { target: "_blank", rel: "noopener noreferrer", "aria-label": "Sponsor on GitHub" },
			});
			ghBtn.appendChild(sanitizeHTMLToDom(GITHUB_SVG));
			ghBtn.createSpan({ text: "GitHub Sponsors" });
			ghBtn.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(githubUrl, "_blank");
			});
		}

		bannerEl.createDiv({ cls: "oc-support-banner-divider" });

		const linksEl = bannerEl.createDiv({ cls: "oc-support-banner-links" });

		const feedbackLink = linksEl.createEl("a", {
			text: "Give feedback",
			cls: "oc-support-text-link",
			attr: { role: "button" },
		});
		feedbackLink.addEventListener("click", (e) => {
			e.preventDefault();
			new FeedbackModal(this.app, "settings").open();
		});

		linksEl.createSpan({ cls: "oc-support-link-sep", text: "·" });

		const featureLink = linksEl.createEl("a", {
			text: "Request a feature",
			cls: "oc-support-text-link",
			attr: { role: "button" },
		});
		featureLink.addEventListener("click", (e) => {
			e.preventDefault();
			new FeatureRequestModal(this.app).open();
		});

		linksEl.createSpan({ cls: "oc-support-link-sep", text: "·" });

		const issuesLink = linksEl.createEl("a", {
			text: "GitHub issues",
			cls: "oc-support-text-link",
			attr: { role: "button" },
		});
		issuesLink.addEventListener("click", (e) => {
			e.preventDefault();
			new GitHubIssueModal(this.app).open();
		});

		linksEl.createSpan({ cls: "oc-support-link-sep", text: "·" });

		const releaseNotesLink = linksEl.createEl("a", {
			text: "Release notes",
			cls: "oc-support-text-link",
			attr: { role: "button" },
		});
		releaseNotesLink.addEventListener("click", (e) => {
			e.preventDefault();
			void this.plugin.showReleaseNotesModal();
		});
	}
}
