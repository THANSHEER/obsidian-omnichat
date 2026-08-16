import { App, Modal } from "obsidian";
import { formatReleaseBody, type ReleaseNotes } from "../feedback/github";
import { FeedbackModal } from "./FeedbackModal";

export class UpdateNotesModal extends Modal {
	private version: string;
	private previousVersion: string;
	private notes: ReleaseNotes | null;

	constructor(
		app: App,
		version: string,
		previousVersion: string,
		notes: ReleaseNotes | null,
	) {
		super(app);
		this.version = version;
		this.previousVersion = previousVersion;
		this.notes = notes;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");
		contentEl.addClass("oc-update-modal");

		contentEl.createEl("h3", { text: `What’s new in ${this.version}` });
		contentEl.createEl("p", {
			text: `Updated from ${this.previousVersion}. Here’s the changelog:`,
			cls: "oc-feedback-lead",
		});

		const body = contentEl.createDiv({ cls: "oc-update-notes" });
		const text = this.notes
			? formatReleaseBody(this.notes.body)
			: "No release notes were found for this version on GitHub yet.";
		body.createEl("pre", { text, cls: "oc-update-notes-pre" });

		if (this.notes?.htmlUrl) {
			const linkRow = contentEl.createDiv({ cls: "oc-update-link-row" });
			const a = linkRow.createEl("a", {
				text: "View full release on GitHub",
				href: this.notes.htmlUrl,
			});
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		}

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const closeBtn = actions.createEl("button", { text: "Close" });
		closeBtn.addEventListener("click", () => this.close());

		const feedbackBtn = actions.createEl("button", { text: "Give feedback", cls: "mod-cta" });
		feedbackBtn.addEventListener("click", () => {
			this.close();
			new FeedbackModal(this.app, "post-update").open();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
