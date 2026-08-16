import { App, Modal, setIcon } from "obsidian";
import type AIChatPlugin from "../main";

interface OnboardingFeature {
	icon: string;
	title: string;
	description: string;
}

const ONBOARDING_FEATURES: OnboardingFeature[] = [
	{
		icon: "layout-grid",
		title: "Switch AI services",
		description: "Jump between ChatGPT, Claude, Gemini, and more from one sidebar.",
	},
	{
		icon: "text-select",
		title: "Send selection",
		description: "Highlight text in a note and send it straight into the active chat.",
	},
	{
		icon: "folder-open",
		title: "Build context",
		description: "Add notes or folders, then inject them into the chat when you need them.",
	},
	{
		icon: "save",
		title: "Save responses",
		description: "Copy an AI reply and save it as a new note or append to an existing one.",
	},
	{
		icon: "columns",
		title: "Split view",
		description: "Open a second panel to keep two AI tools side by side.",
	},
	{
		icon: "link",
		title: "Custom tools",
		description: "Add any AI site by URL so it appears in the same selector.",
	},
];

/**
 * First-run welcome / feature tour. Shown once when lastSeenVersion is empty.
 */
export class WelcomeModal extends Modal {
	private plugin: AIChatPlugin;
	private step = 0;

	constructor(app: App, plugin: AIChatPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.modalEl.addClass("oc-welcome-modal-el");
		this.renderStep();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderStep(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");
		contentEl.addClass("oc-welcome-modal");

		if (this.step === 0) {
			this.renderWelcome();
		} else {
			this.renderFeatures();
		}
	}

	private renderWelcome(): void {
		const { contentEl } = this;

		const hero = contentEl.createDiv({ cls: "oc-welcome-hero" });
		const iconWrap = hero.createDiv({ cls: "oc-welcome-icon" });
		setIcon(iconWrap, "messages-square");

		hero.createEl("h2", { text: "Welcome to OmniChat" });
		hero.createEl("p", {
			text: "Your favorite AI chats — ChatGPT, Claude, Gemini, and more — live in one Obsidian sidebar. Stay in your notes; bring AI to you.",
			cls: "oc-feedback-lead",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const laterBtn = actions.createEl("button", { text: "Maybe later" });
		laterBtn.addEventListener("click", () => this.close());

		const nextBtn = actions.createEl("button", { text: "See what’s inside", cls: "mod-cta" });
		nextBtn.addEventListener("click", () => {
			this.step = 1;
			this.renderStep();
		});
	}

	private renderFeatures(): void {
		const { contentEl } = this;

		contentEl.createEl("h3", { text: "What you can do" });
		contentEl.createEl("p", {
			text: "A quick tour of the essentials — you can explore the rest anytime from the ribbon or settings.",
			cls: "oc-feedback-lead",
		});

		const list = contentEl.createDiv({ cls: "oc-welcome-features" });
		for (const feature of ONBOARDING_FEATURES) {
			const row = list.createDiv({ cls: "oc-welcome-feature" });
			const iconEl = row.createDiv({ cls: "oc-welcome-feature-icon" });
			setIcon(iconEl, feature.icon);
			const text = row.createDiv({ cls: "oc-welcome-feature-text" });
			text.createEl("strong", { text: feature.title });
			text.createEl("span", { text: feature.description });
		}

		const tip = contentEl.createDiv({ cls: "oc-welcome-tip" });
		tip.createEl("strong", { text: "Tip: " });
		tip.createSpan({
			text: "Open OmniChat from the ribbon (messages icon) or Settings → Community plugins → OmniChat.",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const backBtn = actions.createEl("button", { text: "Back" });
		backBtn.addEventListener("click", () => {
			this.step = 0;
			this.renderStep();
		});

		const closeBtn = actions.createEl("button", { text: "Close" });
		closeBtn.addEventListener("click", () => this.close());

		const startBtn = actions.createEl("button", { text: "Open OmniChat", cls: "mod-cta" });
		startBtn.addEventListener("click", () => {
			this.close();
			void this.plugin.activateView();
		});
	}
}
