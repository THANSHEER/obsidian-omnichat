import { describe, it, expect, vi } from "vitest";
import { SIBLING_PLUGINS, MERMAID_FLOW_LOGO_SVG, NOTEFLARE_LOGO_SVG, renderSiblingPluginsSection } from "../modals/siblingPlugins";

describe("Sibling Plugins Showcase", () => {
	it("has exactly two sibling plugin entries", () => {
		expect(SIBLING_PLUGINS).toHaveLength(2);
	});

	it("contains Mermaid Flow and NoteFlare with required metadata", () => {
		const mermaidFlow = SIBLING_PLUGINS.find((p) => p.id === "mermaid-flow");
		const noteflare = SIBLING_PLUGINS.find((p) => p.id === "noteflare");

		expect(mermaidFlow).toBeDefined();
		expect(mermaidFlow?.name).toBe("Mermaid Flow");
		expect(mermaidFlow?.githubUrl).toContain("THANSHEER/obsidian-mermaid-flow");
		expect(mermaidFlow?.description).toBeTruthy();
		expect(mermaidFlow?.badge).toBeTruthy();

		expect(noteflare).toBeDefined();
		expect(noteflare?.name).toBe("NoteFlare");
		expect(noteflare?.githubUrl).toContain("THANSHEER/obsidian-noteflare");
		expect(noteflare?.description).toBeTruthy();
		expect(noteflare?.badge).toBeTruthy();
	});

	it("has valid SVG definitions with unique IDs", () => {
		expect(MERMAID_FLOW_LOGO_SVG).toContain("<svg");
		expect(MERMAID_FLOW_LOGO_SVG).toContain("id=\"mfGlow\"");
		expect(MERMAID_FLOW_LOGO_SVG).toContain("id=\"mfTile\"");

		expect(NOTEFLARE_LOGO_SVG).toContain("<svg");
		expect(NOTEFLARE_LOGO_SVG).toContain("id=\"nfGlow\"");
		expect(NOTEFLARE_LOGO_SVG).toContain("id=\"nfTile\"");
	});

	it("renders sibling plugins cards inside the container", () => {
		interface MockEl {
			cls?: string;
			children: MockEl[];
			listeners: Record<string, (() => void)[]>;
			text?: string;
			appendChild: (child: unknown) => void;
			createDiv: (opts?: { cls?: string }) => MockEl;
			createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
			createEl: (tag: string, opts?: { cls?: string; text?: string }) => MockEl;
			addEventListener: (event: string, cb: () => void) => void;
		}

		function createMockElement(cls?: string): MockEl {
			const el: MockEl = {
				cls,
				children: [],
				listeners: {},
				appendChild(child: unknown) {
					this.children.push(child as MockEl);
				},
				createDiv(opts?: { cls?: string }) {
					const child = createMockElement(opts?.cls);
					this.children.push(child);
					return child;
				},
				createSpan(opts?: { cls?: string; text?: string }) {
					const child = createMockElement(opts?.cls);
					child.text = opts?.text;
					this.children.push(child);
					return child;
				},
				createEl(_tag: string, opts?: { cls?: string; text?: string }) {
					const child = createMockElement(opts?.cls);
					child.text = opts?.text;
					this.children.push(child);
					return child;
				},
				addEventListener(event: string, cb: () => void) {
					if (!this.listeners[event]) this.listeners[event] = [];
					this.listeners[event].push(cb);
				},
			};
			return el;
		}

		const container = createMockElement("container") as unknown as HTMLElement;
		const openSpy = vi.fn();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).window = { open: openSpy };

		renderSiblingPluginsSection(container);

		// Verify structure was created
		const mockContainer = container as unknown as MockEl;
		expect(mockContainer.children).toHaveLength(1);
		const section = mockContainer.children[0];
		expect(section.cls).toBe("oc-sibling-section");

		const cardsContainer = section.children.find((c) => c.cls === "oc-sibling-cards");
		expect(cardsContainer).toBeDefined();
		const cards = cardsContainer?.children.filter((c) => c.cls === "oc-sibling-card");
		expect(cards).toHaveLength(2);

		// Find action buttons and trigger click
		const buttons: MockEl[] = [];
		for (const card of cards || []) {
			const action = card.children.find((c) => c.cls === "oc-sibling-card-action");
			if (action) {
				const btn = action.children.find((c) => c.cls === "oc-sibling-btn");
				if (btn) buttons.push(btn);
			}
		}
		expect(buttons).toHaveLength(2);

		// Click buttons and verify links
		buttons[0].listeners["click"]?.[0]?.();
		expect(openSpy).toHaveBeenCalledWith("https://github.com/THANSHEER/obsidian-mermaid-flow", "_blank");

		buttons[1].listeners["click"]?.[0]?.();
		expect(openSpy).toHaveBeenCalledWith("https://github.com/THANSHEER/obsidian-noteflare", "_blank");
	});
});
