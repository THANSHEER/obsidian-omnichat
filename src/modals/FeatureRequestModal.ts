import { App, Modal } from "obsidian";
import { productFormSiteUrl } from "../feedback/constants";

/**
 * Feature requests are submitted on the Geekstash website, not inside the
 * plugin (see CLAUDE.md — plugins must not call the Worker API or embed
 * Turnstile). This modal just confirms before handing off to the browser.
 */
export class FeatureRequestModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");

		contentEl.createEl("h3", { text: "Request a feature" });
		contentEl.createEl("p", {
			text: "Feature requests open in your browser on the OmniChat feature request page.",
			cls: "oc-feedback-lead",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const openBtn = actions.createEl("button", { text: "Open request form", cls: "mod-cta" });
		openBtn.addEventListener("click", () => {
			window.open(productFormSiteUrl("feature-request"), "_blank");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
