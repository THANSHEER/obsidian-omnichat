import { App, Modal } from "obsidian";
import { productFormSiteUrl } from "../feedback/constants";

/**
 * Feedback is collected on the Geekstash website, not inside the plugin
 * (see CLAUDE.md — plugins must not call the Worker API or embed Turnstile).
 * This modal just confirms before handing off to the browser.
 */
export class FeedbackModal extends Modal {
	private topic: string;

	constructor(app: App, topic = "settings") {
		super(app);
		this.topic = topic;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");

		contentEl.createEl("h3", { text: "Send feedback" });
		contentEl.createEl("p", {
			text: "Feedback opens in your browser on the OmniChat feedback page.",
			cls: "oc-feedback-lead",
		});

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const openBtn = actions.createEl("button", { text: "Open feedback form", cls: "mod-cta" });
		openBtn.addEventListener("click", () => {
			window.open(productFormSiteUrl("feedback", { topic: this.topic }), "_blank");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
