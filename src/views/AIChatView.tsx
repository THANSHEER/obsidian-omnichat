import React from "react";
import { createRoot, Root } from "react-dom/client";
import { ItemView, WorkspaceLeaf } from "obsidian";
import AIChatPlugin from "../main";
import { AIChatPanel } from "../components/AIChatPanel";

export const AI_CHAT_VIEW_TYPE = "ai-chat-sidebar";

export class AIChatView extends ItemView {
	plugin: AIChatPlugin;
	root: Root | null = null;
	pendingText: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AIChatPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return AI_CHAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "AI chat";
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

		this.root.render(
			<AIChatPanel
				app={this.plugin.app}
				webAppUrl={this.plugin.settings.webAppUrl}
				maxContextLength={this.plugin.settings.maxContextLength}
				enableChatGPT={this.plugin.settings.enableChatGPT}
				enableClaude={this.plugin.settings.enableClaude}
				enableDeepSeek={this.plugin.settings.enableDeepSeek}
				enablePerplexity={this.plugin.settings.enablePerplexity}
				enableGemini={this.plugin.settings.enableGemini}
				enableGrok={this.plugin.settings.enableGrok}
				autoRefreshMinutes={this.plugin.settings.autoRefreshMinutes}
				autoClearContext={this.plugin.settings.autoClearContext}
				contextPrefix={this.plugin.settings.contextPrefix}
				initialContextItems={this.plugin.settings.contextItems}
				onContextItemsChange={(items) => { void this.plugin.setContextItems(items); }}
				onUrlChange={(url) => { void this.plugin.setWebAppUrl(url); }}
				pendingText={this.pendingText}
				onPendingTextHandled={() => { this.pendingText = null; this.renderView(); }}
				theme={this.plugin.settings.theme}
			/>,
		);
	}
}
