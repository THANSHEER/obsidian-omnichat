import { App, Notice, PluginSettingTab, sanitizeHTMLToDom, Setting, type SettingDefinitionItem } from "obsidian";
import AIChatPlugin from "./main";
import { CHATGPT_URL, SERVICE_META, ServiceKey, SERVICE_URLS } from "./constants";
import { FeatureRequestModal } from "./modals/FeatureRequestModal";
import { FeedbackModal } from "./modals/FeedbackModal";
import { GitHubIssueModal } from "./modals/GitHubIssueModal";

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
	enableOllama: boolean;
	ollamaApiUrl: string;
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
	formatAIResponse: boolean;
	customServices: CustomService[];
	splitPanelUrl: string;
	/** Last plugin version the user has run — used for first-install welcome and update changelog. */
	lastSeenVersion: string;
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
	formatAIResponse:  true,
	customServices:    [],
	splitPanelUrl:     SERVICE_URLS.claude,
	lastSeenVersion:   "",
};

export class AIChatSettingTab extends PluginSettingTab {
	plugin: AIChatPlugin;

	constructor(app: App, plugin: AIChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		// Return empty array to satisfy the linter warning for declarative settings API.
		// The actual settings are rendered imperatively in renderSettings().
		return [];
	}

	display(): void {
		this.renderSettings();
	}

	renderSettings(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Support Banner ────────────────────────────────────
		const funding = (this.plugin.manifest as unknown as { fundingUrl?: string | Record<string, string> })?.fundingUrl;
		const kofiUrl = typeof funding === "object" && funding !== null
			? Object.entries(funding).find(([k]) => k.toLowerCase().includes("coffee") || k.toLowerCase().includes("ko-fi") || k.toLowerCase().includes("kofi"))?.[1]
			: typeof funding === "string" ? funding : undefined;
		const githubUrl = typeof funding === "object" && funding !== null
			? Object.entries(funding).find(([k]) => k.toLowerCase().includes("github") || k.toLowerCase().includes("sponsor"))?.[1]
			: undefined;

		if (kofiUrl || githubUrl) {
			const bannerEl = containerEl.createDiv({ cls: "oc-support-banner" });

			// Ko-fi inline SVG symbol (official brand asset)
			const KOFI_SVG = `<svg width="24" height="24" viewBox="0 0 241 194" fill="none" xmlns="http://www.w3.org/2000/svg" class="oc-kofi-icon" aria-hidden="true">
				<mask id="oc-kofi-mask" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="-1" y="0" width="242" height="194">
					<path d="M240.469 0.958984H-0.00585938V193.918H240.469V0.958984Z" fill="white"/>
				</mask>
				<g mask="url(#oc-kofi-mask)">
					<path d="M96.1344 193.911C61.1312 193.911 32.6597 178.256 15.9721 149.829C1.19788 124.912 -0.00585938 97.9229 -0.00585938 67.7662C-0.00585938 49.8876 5.37293 34.3215 15.5413 22.7466C24.8861 12.1157 38.1271 5.22907 52.8317 3.35378C70.2858 1.14271 91.9848 0.958984 114.545 0.958984C151.259 0.958984 161.63 1.4088 176.075 2.85328C195.29 4.76026 211.458 11.932 222.824 23.5955C234.368 35.4428 240.469 51.2624 240.469 69.3627V72.9994C240.469 103.885 219.821 129.733 191.046 136.759C188.898 141.827 186.237 146.871 183.089 151.837L183.006 151.964C172.869 167.632 149.042 193.918 103.401 193.918H96.1281L96.1344 193.911Z" fill="white"/>
					<path d="M174.568 17.9772C160.927 16.6151 151.38 16.1589 114.552 16.1589C90.908 16.1589 70.9008 16.387 54.7644 18.4334C33.3949 21.164 15.2058 37.5285 15.2058 67.7674C15.2058 98.0066 16.796 121.422 29.0741 142.107C42.9425 165.751 66.1302 178.707 96.1412 178.707H103.414C140.242 178.707 160.25 159.156 170.253 143.698C174.574 136.874 177.754 130.058 179.801 123.234C205.947 120.96 225.27 99.3624 225.27 72.9941V69.3577C225.27 40.9432 206.631 21.164 174.574 17.9772H174.568Z" fill="white"/>
					<path d="M15.1975 67.7674C15.1975 37.5285 33.3866 21.164 54.7559 18.4334C70.8987 16.387 90.906 16.1589 114.544 16.1589C151.372 16.1589 160.919 16.6151 174.559 17.9772C206.617 21.1576 225.255 40.937 225.255 69.3577V72.9941C225.255 99.3687 205.932 120.966 179.786 123.234C177.74 130.058 174.559 136.874 170.238 143.698C160.235 159.156 140.228 178.707 103.4 178.707H96.1264C66.1155 178.707 42.9277 165.751 29.0595 142.107C16.7814 121.422 15.1912 98.4563 15.1912 67.7674" fill="#202020"/>
					<path d="M32.2469 67.9899C32.2469 97.3168 34.0654 116.184 43.6127 133.689C54.5225 153.924 74.3018 161.653 96.8117 161.653H103.857C133.411 161.653 147.736 147.329 155.693 134.829C159.558 128.462 162.966 121.417 164.784 112.547L166.147 106.864H174.332C192.521 106.864 208.208 92.09 208.208 73.2166V69.8082C208.208 48.6669 195.024 37.5228 172.058 34.7987C159.102 33.6646 151.372 33.2084 114.538 33.2084C89.7602 33.2084 72.0272 33.4364 58.6152 35.4828C39.7483 38.2134 32.2407 48.8951 32.2407 67.9899" fill="white"/>
					<path d="M166.158 83.6801C166.158 86.4107 168.204 88.4572 171.841 88.4572C183.435 88.4572 189.802 81.8619 189.802 70.9523C189.802 60.0427 183.435 53.2195 171.841 53.2195C168.204 53.2195 166.158 55.2657 166.158 57.9963V83.6866V83.6801Z" fill="#202020"/>
					<path d="M54.5321 82.3198C54.5321 95.732 62.0332 107.326 71.5807 116.424C77.9478 122.562 87.9515 128.93 94.7685 133.022C96.8147 134.157 98.8611 134.841 101.136 134.841C103.866 134.841 106.134 134.157 107.959 133.022C114.782 128.93 124.779 122.562 130.919 116.424C140.694 107.332 148.195 95.7383 148.195 82.3198C148.195 67.7673 137.286 54.8115 121.599 54.8115C112.28 54.8115 105.912 59.5882 101.136 66.1772C96.8147 59.582 90.2259 54.8115 80.9001 54.8115C64.9855 54.8115 54.5256 67.7673 54.5256 82.3198" fill="#FF5A16"/>
				</g>
			</svg>`;

			// GitHub Sponsors heart SVG
			const GITHUB_SVG = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path d="M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 008 13.393a20.561 20.561 0 003.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 01-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5z"/>
			</svg>`;

			// ── Sponsor buttons row ───────────────────────────────────
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

			// ── Divider ──────────────────────────────────────────────
			bannerEl.createDiv({ cls: "oc-support-banner-divider" });

			// ── Feedback text-link row ───────────────────────────────
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
		}

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

		new Setting(containerEl)
			.setName("Ollama API URL")
			.setDesc("The base URL for your local or remote ollama instance (default: http://127.0.0.1:11434).")
			.addText(t =>
				t.setPlaceholder("127.0.0.1:11434")
					.setValue(this.plugin.settings.ollamaApiUrl)
					.onChange(async v => {
						this.plugin.settings.ollamaApiUrl = v.trim() || "http://127.0.0.1:11434";
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenViews();
					}),
			);

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
			.setName("Default split panel service")
			.setDesc("Which AI opens in the split panel by default.")
			.addDropdown(d => {
				for (const m of SERVICE_META) d.addOption(m.key, m.label);
				d.setValue(getServiceKey(this.plugin.settings.splitPanelUrl) ?? SERVICE_META[0].key)
					.onChange(async v => {
						this.plugin.settings.splitPanelUrl = SERVICE_URLS[v as ServiceKey];
						await this.plugin.saveSettings();
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
					t.setPlaceholder("Enter URL…").setValue(svc.url)
						.onChange(async v => {
							const normalized = normalizeUrl(v);
							const duplicate  = this.plugin.settings.customServices.some(s => s.id !== svc.id && s.url === normalized);
							if (duplicate) { new Notice("A custom service with this URL already exists."); return; }
							svc.url = normalized;
							await this.plugin.saveSettings();
							this.plugin.rerenderOpenViews();
						});
					t.inputEl.addClass("vc-custom-svc-url");
					return t;
				})
				.addButton(btn => {
					// Apply warning colour without using the deprecated setWarning() or the
					// v1.13-gated setDestructive() — both are unavailable at minAppVersion 1.7.2.
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

		// ── Prompt templates ──────────────────────────────────
		new Setting(containerEl).setName("Prompt templates").setHeading();

		new Setting(containerEl)
			.setName("Add template")
			.setDesc("One-click prompts that inject text into the active AI service. Variables: {{selection}}, {{title}}, {{path}}, {{tags}}, {{date}}.")
			.addButton(btn =>
				btn.setButtonText("+ add").setCta().onClick(async () => {
					this.plugin.settings.promptTemplates.push({ id: Date.now().toString(), label: "New template", text: "" });
					await this.plugin.saveSettings();
					this.renderSettings();
				}),
			);

		if (!this.plugin.settings.promptTemplates.length) {
			new Setting(containerEl).setDesc("No templates yet — add one to get started.");
		}

		this.plugin.settings.promptTemplates.forEach((tmpl, index) => {
			// Title row — editable label with a delete button.
			const titleRow = new Setting(containerEl)
				.setName(`Template ${index + 1}`)
				.addText(t =>
					t.setPlaceholder("Title (e.g. Summarise)").setValue(tmpl.label)
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

			// Prompt row — full-width textarea for the template body.
			const promptRow = new Setting(containerEl)
				.setName("Prompt")
				.setDesc("Text inserted into the AI input.")
				.addTextArea(t => {
					t.setPlaceholder("Prompt text…").setValue(tmpl.text)
						.onChange(async v => { tmpl.text = v; await this.plugin.saveSettings(); });
					t.inputEl.rows = 4;
					t.inputEl.addClass("vc-template-textarea");
					return t;
				});
			promptRow.settingEl.addClass("vc-template-prompt-row");
		});
	}
}
