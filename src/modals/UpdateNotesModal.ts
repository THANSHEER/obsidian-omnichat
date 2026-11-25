import { App, Component, MarkdownRenderer, Modal, sanitizeHTMLToDom } from "obsidian";
import { type ReleaseNotes } from "../feedback/github";
import { FeedbackModal } from "./FeedbackModal";
import { FeatureRequestModal } from "./FeatureRequestModal";
import { GITHUB_REPO } from "../feedback/constants";
import { renderSiblingPluginsSection } from "./siblingPlugins";
import { t } from "../i18n";

/** Official OmniChat logo SVG (from assests/logo.svg), without SVG filters stripped by sanitizeHTMLToDom. */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 80 80" fill="none" class="oc-modal-logo" aria-hidden="true">
  <defs>
    <radialGradient id="um-omniGlow" cx="0.5" cy="1.3" r="0.9">
      <stop offset="0%" stop-color="rgb(139,92,246)"/>
      <stop offset="100%" stop-color="rgb(139,92,246)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="um-omniSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(255,255,255)" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.18"/>
    </linearGradient>
    <clipPath id="um-omniTile"><rect width="80" height="80" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#um-omniTile)">
    <rect width="80" height="80" fill="rgb(131,94,238)"/>
    <rect width="80" height="80" fill="url(#um-omniSheen)" opacity="0.5"/>
    <rect width="80" height="80" fill="url(#um-omniGlow)"/>
  </g>
  <rect x="0.5" y="0.5" width="79" height="79" rx="15.5" fill="none"
        stroke="rgb(255,255,255)" stroke-opacity="0.1" stroke-width="1"/>
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
</svg>`;

export class UpdateNotesModal extends Modal {
	private version: string;
	private previousVersion: string;
	private notes: ReleaseNotes | null;
	private component: Component;

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
		this.component = new Component();
	}

	onOpen(): void {
		this.component.load();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("oc-feedback-modal");
		contentEl.addClass("oc-update-modal");

		// ── Compact Header ────────────────────────────────────────
		const header = contentEl.createDiv({ cls: "oc-update-header" });
		const logoWrap = header.createDiv({ cls: "oc-update-logo-wrap" });
		logoWrap.appendChild(sanitizeHTMLToDom(LOGO_SVG));

		const titleCol = header.createDiv({ cls: "oc-update-title-col" });
		titleCol.createEl("h3", { text: t("modal.whatsNew.title", { version: this.version }) });

		const metaRow = titleCol.createDiv({ cls: "oc-update-meta-row" });
		metaRow.createSpan({
			cls: "oc-update-version-badge",
			text: t("modal.whatsNew.updatedFrom", { previous: this.previousVersion }),
		});
		if (this.notes?.htmlUrl) {
			const ghLink = metaRow.createEl("a", {
				cls: "oc-update-gh-link",
				text: "View on GitHub →",
				href: this.notes.htmlUrl,
			});
			ghLink.setAttr("target", "_blank");
			ghLink.setAttr("rel", "noopener");
		}

		// ── Current Version Changelog ─────────────────────────────
		const body = contentEl.createDiv({ cls: "oc-update-notes markdown-rendered" });
		const rawBody = this.notes?.body?.trim();
		if (rawBody) {
			void MarkdownRenderer.render(this.app, rawBody, body, "", this.component);
		} else {
			const empty = body.createDiv({ cls: "oc-update-empty" });
			empty.createEl("p", {
				text: `Release notes for v${this.version} are not available offline or have not been published to GitHub yet.`,
			});
			const releasesLink = empty.createEl("a", {
				text: "View releases on GitHub →",
				href: `https://github.com/${GITHUB_REPO}/releases`,
			});
			releasesLink.setAttr("target", "_blank");
			releasesLink.setAttr("rel", "noopener");
		}

		// ── Other Plugins ─────────────────────────────────────────
		renderSiblingPluginsSection(contentEl);

		// ── Action Buttons ────────────────────────────────────────
		const actions = contentEl.createDiv({ cls: "oc-feedback-actions oc-update-actions" });

		const closeBtn = actions.createEl("button", { text: t("common.close") });
		closeBtn.addEventListener("click", () => this.close());

		const issuesBtn = actions.createEl("button", { text: t("modal.whatsNew.githubIssues") });
		issuesBtn.addEventListener("click", () => {
			window.open(`https://github.com/${GITHUB_REPO}/issues`, "_blank");
		});

		const featureBtn = actions.createEl("button", { text: t("modal.whatsNew.requestFeature") });
		featureBtn.addEventListener("click", () => {
			this.close();
			new FeatureRequestModal(this.app).open();
		});

		const feedbackBtn = actions.createEl("button", { text: t("modal.whatsNew.giveFeedback"), cls: "mod-cta" });
		feedbackBtn.addEventListener("click", () => {
			this.close();
			new FeedbackModal(this.app, "post-update").open();
		});
	}

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
	}
}
