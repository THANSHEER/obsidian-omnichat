import { App, Modal } from "obsidian";
import { productFormSiteUrl } from "../feedback/constants";

/**
 * Uninstall notice. Shown when the user uninstalls OmniChat
 * (not when they only disable it). No longer shown from Settings.
 * The survey link opens in the browser — plugins must not call the
 * Worker API or embed Turnstile (see CLAUDE.md).
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

		const lead = contentEl.createEl("p", { cls: "oc-feedback-lead oc-uninstall-lead" });
		lead.appendText("Sorry to see you go. If you have a moment, please ");

		const link = lead.createEl("a", {
			text: "share your feedback",
			href: productFormSiteUrl("uninstall"),
			cls: "oc-uninstall-feedback-link",
		});
		link.setAttr("target", "_blank");
		link.setAttr("rel", "noopener noreferrer");
		link.addEventListener("click", (e) => {
			e.preventDefault();
			window.open(productFormSiteUrl("uninstall"), "_blank");
		});

		lead.appendText(" — it helps us improve. You can skip this.");

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const skipBtn = actions.createEl("button", { text: "Close", cls: "mod-cta" });
		skipBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
		const done = this.onDone;
		this.onDone = null;
		done?.();
	}
}
