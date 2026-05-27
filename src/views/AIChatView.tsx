import React from "react";
import { createRoot, Root } from "react-dom/client";
import { ItemView, WorkspaceLeaf } from "obsidian";
import AIChatPlugin from "../main";
import { AIChatPanel } from "../components/AIChatPanel";

export const AI_CHAT_VIEW_TYPE       = "aibrowser-chat-view";
export const AI_CHAT_SPLIT_VIEW_TYPE = "aibrowser-chat-split-view";

export class AIChatView extends ItemView {
	plugin: AIChatPlugin;
	root: Root | null = null;
	pendingText: string | null = null;
	isPrimary: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: AIChatPlugin, isPrimary = true) {
		super(leaf);
		this.plugin    = plugin;
		this.isPrimary = isPrimary;
	}

	getViewType(): string {
		return this.isPrimary ? AI_CHAT_VIEW_TYPE : AI_CHAT_SPLIT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.isPrimary ? "AI Hub" : "AI Hub (2)";
	}

	getIcon(): string {
		return "messages-square";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("ai-chat-view");

		const container = this.contentEl.createDiv({ cls: "ai-chat-root" });
		this.root = createRoot(container);
		this.renderView();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
		this.contentEl.removeClass("ai-chat-view");
	}

	injectText(text: string): void {
		this.pendingText = text;
		this.renderView();
	}

	renderView(): void {
		if (!this.root) return;

		const url = this.isPrimary
			? this.plugin.settings.webAppUrl
			: this.plugin.settings.splitPanelUrl;

		const onUrlChange = this.isPrimary
			? (u: string) => { void this.plugin.setWebAppUrl(u); }
			: (u: string) => { void this.plugin.setSplitPanelUrl(u); };

		this.root.render(
			<AIChatPanel
				app={this.plugin.app}
				webAppUrl={url}
				maxContextLength={this.plugin.settings.maxContextLength}
				enableChatGPT={this.plugin.settings.enableChatGPT}
				enableClaude={this.plugin.settings.enableClaude}
				enableDeepSeek={this.plugin.settings.enableDeepSeek}
				enablePerplexity={this.plugin.settings.enablePerplexity}
				enableGemini={this.plugin.settings.enableGemini}
				enableGrok={this.plugin.settings.enableGrok}
				enableCopilot={this.plugin.settings.enableCopilot}
				enableManus={this.plugin.settings.enableManus}
				enableKimi={this.plugin.settings.enableKimi}
				autoRefreshMinutes={this.plugin.settings.autoRefreshMinutes}
				autoClearContext={this.plugin.settings.autoClearContext}
				contextPrefix={this.plugin.settings.contextPrefix}
				initialContextItems={this.plugin.settings.contextItems}
				onContextItemsChange={(items) => { void this.plugin.setContextItems(items); }}
				onUrlChange={onUrlChange}
				pendingText={this.pendingText}
				onPendingTextHandled={() => { this.pendingText = null; this.renderView(); }}
				theme={this.plugin.settings.theme}
				promptTemplates={this.plugin.settings.promptTemplates}
				autoContextOnOpen={this.plugin.settings.autoContextOnOpen}
				stripFrontmatter={this.plugin.settings.stripFrontmatter}
				saveNoteFolder={this.plugin.settings.saveNoteFolder}
				customServices={this.plugin.settings.customServices}
			/>,
		);
	}
}
