import { Editor } from "obsidian";
import AIChatPlugin from "../main";

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
		id: "send-selection",
		name: "Send selected text to AI",
		editorCallback: (editor: Editor) => void plugin.sendSelectionToAI(editor.getSelection()),
	});
}
