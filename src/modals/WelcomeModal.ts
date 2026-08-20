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

/** Inline plugin logo SVG (from assests/logo.svg). IDs are scoped to avoid conflicts. */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 80 80" fill="none" class="oc-modal-logo" aria-hidden="true">
  <defs>
    <radialGradient id="wm-omniGlow" cx="0.5" cy="1.3" r="0.9">
      <stop offset="0%" stop-color="rgb(139,92,246)"/>
      <stop offset="100%" stop-color="rgb(139,92,246)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wm-omniSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(255,255,255)" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="wm-omniIconShadow" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="1" stdDeviation="0" flood-color="rgb(0,0,0)" flood-opacity="0.2"/>
    </filter>
    <clipPath id="wm-omniTile"><rect width="80" height="80" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#wm-omniTile)">
    <rect width="80" height="80" fill="rgb(131,94,238)"/>
    <rect width="80" height="80" fill="url(#wm-omniSheen)" style="mix-blend-mode:soft-light"/>
    <rect width="80" height="80" fill="url(#wm-omniGlow)"/>
  </g>
  <rect x="0.5" y="0.5" width="79" height="79" rx="15.5" fill="none"
        stroke="rgb(255,255,255)" stroke-opacity="0.1" stroke-width="1"/>
  <g filter="url(#wm-omniIconShadow)">
    <g transform="translate(20 20) scale(1.66667)"
       fill="none" stroke="#ffffff" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </g>
  </g>
</svg>`;

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

		// Plugin logo at the top
		const logoWrap = hero.createDiv({ cls: "oc-modal-logo-wrap" });
		logoWrap.innerHTML = LOGO_SVG;

		hero.createEl("h2", { text: "Welcome to OmniChat" });
		hero.createEl("p", {
			text: "Your favorite AI chats — ChatGPT, Claude, Gemini, and more — live in one Obsidian sidebar. Stay in your notes; bring AI to you.",
			cls: "oc-feedback-lead",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const laterBtn = actions.createEl("button", { text: "Maybe later" });
		laterBtn.addEventListener("click", () => this.close());

		const nextBtn = actions.createEl("button", { text: "See what's inside", cls: "mod-cta" });
		nextBtn.addEventListener("click", () => {
			this.step = 1;
			this.renderStep();
		});
	}

	private renderFeatures(): void {
		const { contentEl } = this;

		// Logo at the top of features step too
		const logoWrap = contentEl.createDiv({ cls: "oc-modal-logo-wrap" });
		logoWrap.innerHTML = LOGO_SVG;

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
			text.createSpan({ text: feature.description });
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
