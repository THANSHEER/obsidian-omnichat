import { App, Modal } from "obsidian";
import { productFormSiteUrl } from "../feedback/constants";

/**
 * Optional uninstall survey. Shown when the user uninstalls OmniChat
 * (not when they only disable it), or from Settings. The survey itself is
 * collected on the Geekstash website, not inside the plugin (see CLAUDE.md —
 * plugins must not call the Worker API or embed Turnstile).
 */
export class UninstallFeedbackModal extends Modal {
	private onDone: (() => void) | null;

	constructor(app: App, onDone?: () => void) {
		super(app);
		this.onDone = onDone ?? null;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");
		contentEl.addClass("oc-uninstall-modal");

		contentEl.createEl("h2", { text: "Leaving OmniChat?" });
		contentEl.createEl("p", {
			text: "Sorry to see you go. If you have a moment, the uninstall survey opens in your browser — it helps us improve. You can skip this.",
			cls: "oc-feedback-lead",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const skipBtn = actions.createEl("button", { text: "Skip" });
		skipBtn.addEventListener("click", () => this.close());

		const openBtn = actions.createEl("button", { text: "Open survey", cls: "mod-cta" });
		openBtn.addEventListener("click", () => {
			window.open(productFormSiteUrl("uninstall"), "_blank");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		const done = this.onDone;
		this.onDone = null;
		done?.();
	}
}
