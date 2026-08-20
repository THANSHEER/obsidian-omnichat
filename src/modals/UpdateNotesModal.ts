import { App, Modal } from "obsidian";
import { formatReleaseBody, type ReleaseNotes } from "../feedback/github";
import { FeedbackModal } from "./FeedbackModal";
import { FeatureRequestModal } from "./FeatureRequestModal";
import { GITHUB_REPO } from "../feedback/constants";

/** Inline plugin logo SVG (from assests/logo.svg). IDs are scoped to avoid conflicts. */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 80 80" fill="none" class="oc-modal-logo" aria-hidden="true">
  <defs>
    <radialGradient id="um-omniGlow" cx="0.5" cy="1.3" r="0.9">
      <stop offset="0%" stop-color="rgb(139,92,246)"/>
      <stop offset="100%" stop-color="rgb(139,92,246)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="um-omniSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(255,255,255)" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="um-omniIconShadow" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="1" stdDeviation="0" flood-color="rgb(0,0,0)" flood-opacity="0.2"/>
    </filter>
    <clipPath id="um-omniTile"><rect width="80" height="80" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#um-omniTile)">
    <rect width="80" height="80" fill="rgb(131,94,238)"/>
    <rect width="80" height="80" fill="url(#um-omniSheen)" style="mix-blend-mode:soft-light"/>
    <rect width="80" height="80" fill="url(#um-omniGlow)"/>
  </g>
  <rect x="0.5" y="0.5" width="79" height="79" rx="15.5" fill="none"
        stroke="rgb(255,255,255)" stroke-opacity="0.1" stroke-width="1"/>
  <g filter="url(#um-omniIconShadow)">
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

		// Plugin logo at the top
		const logoWrap = contentEl.createDiv({ cls: "oc-modal-logo-wrap" });
		logoWrap.innerHTML = LOGO_SVG;

		contentEl.createEl("h3", { text: `What's new in ${this.version}` });
		contentEl.createEl("p", {
			text: `Updated from ${this.previousVersion}. Here's the changelog:`,
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
				text: "View full release on GitHub →",
				href: this.notes.htmlUrl,
			});
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		}

		// ── Three action buttons ──────────────────────────────────
		const actions = contentEl.createDiv({ cls: "oc-feedback-actions oc-update-actions" });

		const closeBtn = actions.createEl("button", { text: "Close" });
		closeBtn.addEventListener("click", () => this.close());

		const issuesBtn = actions.createEl("button", { text: "GitHub Issues" });
		issuesBtn.addEventListener("click", () => {
			window.open(`https://github.com/${GITHUB_REPO}/issues`, "_blank");
		});

		const featureBtn = actions.createEl("button", { text: "Request a feature" });
		featureBtn.addEventListener("click", () => {
			this.close();
			new FeatureRequestModal(this.app).open();
		});

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
