import { App, Modal, setIcon } from "obsidian";
import { GITHUB_REPO } from "../feedback/constants";

const ISSUE_TYPES = [
	{
		icon: "bug",
		label: "Bug report",
		desc: "Something isn't working.",
		template: "bug_report",
	},
	{
		icon: "lightbulb",
		label: "Feature request",
		desc: "Suggest an improvement.",
		template: "feature_request",
	},
] as const;

/** Opens a GitHub new-issue page with the appropriate template pre-selected. */
export class GitHubIssueModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");
		contentEl.addClass("oc-issue-modal");

		contentEl.createEl("h3", { text: "Open a GitHub issue" });
		contentEl.createEl("p", {
			text: "Choose a type — opens in your browser.",
			cls: "oc-feedback-lead",
		});

		const cards = contentEl.createDiv({ cls: "oc-issue-cards" });

		for (const type of ISSUE_TYPES) {
			const card = cards.createDiv({ cls: "oc-issue-card" });

			const iconEl = card.createDiv({ cls: "oc-issue-card-icon" });
			setIcon(iconEl, type.icon);

			const textEl = card.createDiv({ cls: "oc-issue-card-text" });
			textEl.createEl("strong", { text: type.label });
			textEl.createSpan({ text: type.desc });

			card.addEventListener("click", () => {
				const url = `https://github.com/${GITHUB_REPO}/issues/new?template=${type.template}.md`;
				window.open(url, "_blank");
				this.close();
			});
		}

		const actions = contentEl.createDiv({ cls: "oc-feedback-actions" });
		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
