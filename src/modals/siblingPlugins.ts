import { sanitizeHTMLToDom } from "obsidian";

export interface SiblingPluginInfo {
	id: string;
	name: string;
	badge: string;
	description: string;
	githubUrl: string;
	logoSvg: string;
}

export const MERMAID_FLOW_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 80 80" fill="none" class="oc-sibling-logo" aria-hidden="true">
  <defs>
    <radialGradient id="mfGlow" cx="0.5" cy="1.3" r="0.9">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mfSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
    <clipPath id="mfTile"><rect width="80" height="80" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#mfTile)">
    <rect width="80" height="80" fill="#fb464c"/>
    <rect width="80" height="80" fill="url(#mfSheen)" opacity="0.5"/>
    <rect width="80" height="80" fill="url(#mfGlow)"/>
  </g>
  <rect x="0.5" y="0.5" width="79" height="79" rx="15.5" fill="none"
        stroke="rgb(255,255,255)" stroke-opacity="0.1" stroke-width="1"/>
  <g transform="translate(20 20) scale(1.66667)"
     fill="none" stroke="#ffffff" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
    <rect width="8" height="8" x="3" y="3" rx="2"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4"/>
    <rect width="8" height="8" x="13" y="13" rx="2"/>
  </g>
</svg>`;

export const NOTEFLARE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 80 80" fill="none" class="oc-sibling-logo" aria-hidden="true">
  <defs>
    <radialGradient id="nfGlow" cx="0.5" cy="1.3" r="0.9">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="nfSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
    <clipPath id="nfTile"><rect width="80" height="80" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#nfTile)">
    <rect width="80" height="80" fill="#44cf6e"/>
    <rect width="80" height="80" fill="url(#nfSheen)" opacity="0.5"/>
    <rect width="80" height="80" fill="url(#nfGlow)"/>
  </g>
  <rect x="0.5" y="0.5" width="79" height="79" rx="15.5" fill="none"
        stroke="rgb(255,255,255)" stroke-opacity="0.1" stroke-width="1"/>
  <g transform="translate(20 20) scale(1.66667)"
     fill="none" stroke="#ffffff" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </g>
</svg>`;

export const SIBLING_PLUGINS: SiblingPluginInfo[] = [
	{
		id: "mermaid-flow",
		name: "Mermaid Flow",
		badge: "Visual diagrams",
		description: "Visual WYSIWYG diagram and flowchart editor for Mermaid in Obsidian.",
		githubUrl: "https://github.com/THANSHEER/obsidian-mermaid-flow",
		logoSvg: MERMAID_FLOW_LOGO_SVG,
	},
	{
		id: "noteflare",
		name: "NoteFlare",
		badge: "Publish & backup",
		description: "Publish notes as a website and protect your vault with automatic private backups.",
		githubUrl: "https://github.com/THANSHEER/obsidian-noteflare",
		logoSvg: NOTEFLARE_LOGO_SVG,
	},
];

export function renderSiblingPluginsSection(containerEl: HTMLElement): void {
	const section = containerEl.createDiv({ cls: "oc-sibling-section" });

	const header = section.createDiv({ cls: "oc-sibling-header" });
	header.createSpan({ cls: "oc-sibling-title", text: "Other plugins from the creator" });

	const cardsContainer = section.createDiv({ cls: "oc-sibling-cards" });

	for (const plugin of SIBLING_PLUGINS) {
		const card = cardsContainer.createDiv({ cls: "oc-sibling-card" });

		// Logo
		const logoWrap = card.createDiv({ cls: "oc-sibling-card-logo" });
		logoWrap.appendChild(sanitizeHTMLToDom(plugin.logoSvg));

		// Content
		const info = card.createDiv({ cls: "oc-sibling-card-info" });
		const titleRow = info.createDiv({ cls: "oc-sibling-card-title-row" });
		titleRow.createSpan({ cls: "oc-sibling-card-name", text: plugin.name });
		titleRow.createSpan({ cls: "oc-sibling-card-badge", text: plugin.badge });

		info.createEl("p", { cls: "oc-sibling-card-desc", text: plugin.description });

		// Action
		const actionWrap = card.createDiv({ cls: "oc-sibling-card-action" });
		const btn = actionWrap.createEl("button", {
			cls: "oc-sibling-btn",
			text: "View plugin",
		});
		btn.addEventListener("click", () => {
			window.open(plugin.githubUrl, "_blank");
		});
	}
}
