import { App, Editor, FuzzySuggestModal, Notice } from "obsidian";
import AIChatPlugin from "../main";
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

	plugin.addCommand({
		id: "open-chatgpt",
		name: "Open ChatGPT",
		callback: () => void plugin.openChatGpt(),
	});

	plugin.addCommand({
		id: "open-claude",
		name: "Open Claude",
		callback: () => void plugin.openClaude(),
	});

	plugin.addCommand({
		id: "open-deepseek",
		name: "Open DeepSeek",
		callback: () => void plugin.openDeepSeek(),
	});

	plugin.addCommand({
		id: "open-perplexity",
		name: "Open Perplexity",
		callback: () => void plugin.openPerplexity(),
	});

	plugin.addCommand({
		id: "open-gemini",
		name: "Open Gemini",
		callback: () => void plugin.openGemini(),
	});

	plugin.addCommand({
		id: "open-grok",
		name: "Open Grok",
		callback: () => void plugin.openGrok(),
	});

	plugin.addCommand({
		id: "open-copilot",
		name: "Open Copilot",
		callback: () => void plugin.openCopilot(),
	});

	plugin.addCommand({
		id: "open-manus",
		name: "Open Manus AI",
		callback: () => void plugin.openManus(),
	});

	plugin.addCommand({
		id: "open-kimi",
		name: "Open Kimi",
		callback: () => void plugin.openKimi(),
	});

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

	// Feature 6: add active note to context from command palette
	plugin.addCommand({
		id: "add-active-note-to-context",
		name: "Add active note to context",
		callback: () => void plugin.addActiveNoteToContext(),
	});

	// Feature 9: send editor selection prepended with a chosen prompt template
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
