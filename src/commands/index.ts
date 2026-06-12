import { App, Editor, FuzzySuggestModal, Notice } from "obsidian";
import AIChatPlugin from "../main";
import { SERVICE_META } from "../constants";
import { PromptTemplate } from "../settings";

class TemplatePickerModal extends FuzzySuggestModal<PromptTemplate> {
	private readonly templates: PromptTemplate[];
	private readonly onSelect: (t: PromptTemplate) => void;

	constructor(app: App, templates: PromptTemplate[], onSelect: (t: PromptTemplate) => void) {
		super(app);
		this.templates = templates;
		this.onSelect  = onSelect;
		this.setPlaceholder("Pick a template…");
	}

	getItems(): PromptTemplate[]                   { return this.templates; }
	getItemText(t: PromptTemplate): string         { return t.label; }
	onChooseItem(t: PromptTemplate): void          { this.onSelect(t); }
}

export function registerCommands(plugin: AIChatPlugin): void {
	plugin.addCommand({
		id: "open",
		name: "Open",
		callback: () => void plugin.openAIChat(),
	});

	// One "Open <Service>" command per built-in service, derived from the registry.
	// IDs (open-<key>) and names match the previous hand-written commands, so any
	// user-bound hotkeys are preserved.
	for (const svc of SERVICE_META) {
		plugin.addCommand({
			id: `open-${svc.key}`,
			name: `Open ${svc.label}`,
			callback: () => void plugin.openService(svc.key),
		});
	}

	plugin.addCommand({
		id: "open-split-panel",
		name: "Open split panel",
		callback: () => void plugin.openSplitPanel(),
	});

	plugin.addCommand({
		id: "send-selection",
		name: "Send selected text to AI",
		editorCallback: (editor: Editor) => void plugin.sendSelectionToAI(editor.getSelection()),
	});

	plugin.addCommand({
		id: "toggle",
		name: "Toggle sidebar",
		callback: () => void plugin.toggleView(),
	});

	plugin.addCommand({
		id: "cycle-service",
		name: "Cycle to next AI service",
		callback: () => void plugin.cycleService(),
	});

	plugin.addCommand({
		id: "add-active-note-to-context",
		name: "Add active note to context",
		callback: () => void plugin.addActiveNoteToContext(),
	});

	plugin.addCommand({
		id: "clear-all-context",
		name: "Clear all context",
		callback: () => void plugin.clearAllContext(),
	});

	plugin.addCommand({
		id: "send-selection-with-template",
		name: "Send selection with template",
		editorCallback: (editor: Editor) => {
			const selection = editor.getSelection();
			if (!selection.trim()) { new Notice("Select some text first."); return; }
			const templates = plugin.settings.promptTemplates;
			if (!templates.length) { new Notice("No prompt templates configured — add one in settings."); return; }
			new TemplatePickerModal(plugin.app, templates, (t) => {
				void plugin.sendSelectionWithTemplate(selection, t.text);
			}).open();
		},
	});
}
