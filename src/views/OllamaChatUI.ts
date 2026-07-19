import { Notice, setIcon } from "obsidian";
import type AIChatPlugin from "../main";

export class OllamaChatUI {
	container: HTMLElement;
	modelSelect: HTMLSelectElement;
	chatLog: HTMLElement;
	input: HTMLTextAreaElement;
	sendBtn: HTMLButtonElement;
	
	private history: { role: string; content: string }[] = [];
	private isGenerating = false;
	private abortController: AbortController | null = null;
	
	private plugin: AIChatPlugin;
	
	constructor(parent: HTMLElement, plugin: AIChatPlugin) {
		this.plugin = plugin;
		this.container = parent.createDiv({ cls: "ollama-chat-container" });
		this.render();
		void this.fetchModels();
	}
	
	private render() {
		this.container.empty();
		
		const header = this.container.createDiv({ cls: "ollama-glass-header" });
		const title = header.createDiv({ cls: "ollama-header-title" });
		title.createDiv({ cls: "ollama-glow-dot" });
		title.createSpan({ cls: "ollama-gradient-text", text: "Ollama Local" });
		
		const selectWrapper = header.createDiv({ cls: "ollama-select-wrapper" });
		this.modelSelect = selectWrapper.createEl("select", { cls: "ollama-model-select" });
		this.modelSelect.createEl("option", { value: "", text: "No models found" });
		selectWrapper.createDiv({ cls: "ollama-select-arrow" });
		
		const scrollArea = this.container.createDiv({ cls: "ollama-chat-scroll-area" });
		this.chatLog = scrollArea.createDiv({ cls: "ollama-chat-log" });
		
		const welcomeCard = this.chatLog.createDiv({ cls: "ollama-welcome-card" });
		welcomeCard.createEl("h4", { text: "Welcome to local AI" });
		welcomeCard.createEl("p", { text: "Fully private, running right on your machine." });
		
		const inputContainer = this.container.createDiv({ cls: "ollama-input-container" });
		const inputGlass = inputContainer.createDiv({ cls: "ollama-input-glass" });
		this.input = inputGlass.createEl("textarea", { cls: "ollama-input-box" });
		this.input.placeholder = "Ask ollama anything...";
		this.input.rows = 1;
		
		this.sendBtn = inputGlass.createEl("button", { cls: "ollama-send-btn" });
		this.sendBtn.disabled = true;
		setIcon(this.sendBtn, "send");
		
		const footerTextContainer = inputContainer.createDiv({ cls: "ollama-footer-text", text: "Powered by Ollama API at " });
		footerTextContainer.createSpan({ cls: "ollama-api-url-text", text: this.plugin.settings.ollamaApiUrl });
		
		this.setupListeners();
	}
	
	private setupListeners() {
		this.input.addEventListener("input", () => {
			(this.input.style as unknown as Record<string, string>).height = "auto";
			(this.input.style as unknown as Record<string, string>).height = Math.min(this.input.scrollHeight, 120) + "px";
			this.sendBtn.disabled = this.input.value.trim() === "" || this.isGenerating;
		});
		
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.sendMessage();
			}
		});
		
		this.sendBtn.addEventListener("click", () => { void this.sendMessage(); });
	}
	
	private async fetchModels() {
		try {
			const baseUrl = this.plugin.settings.ollamaApiUrl.replace(/\/$/, "");
			const res = await activeWindow.fetch(`${baseUrl}/api/tags`);
			if (!res.ok) throw new Error("Failed to fetch models");
			const data = await res.json() as { models?: { name: string }[] };
			if (data.models && data.models.length > 0) {
				this.modelSelect.empty();
				for (const m of data.models) {
					this.modelSelect.createEl("option", { value: m.name ?? "", text: m.name ?? "" });
				}
			}
		} catch {
			this.modelSelect.empty();
			this.modelSelect.createEl("option", { value: "", text: "Ollama not running?" });
		}
	}
	
	public injectContext(text: string) {
		this.input.value = this.input.value + text;
		this.input.dispatchEvent(new Event("input"));
		this.input.focus();
	}
	
	private setBubbleText(bubble: HTMLElement, text: string) {
		bubble.empty();
		const lines = text.split("\n");
		for (let i = 0; i < lines.length; i++) {
			bubble.appendText(lines[i] ?? "");
			if (i < lines.length - 1) {
				bubble.createEl("br");
			}
		}
	}
	
	private appendMessage(role: "user" | "bot", content: string): HTMLElement {
		const msgEl = this.chatLog.createDiv({ cls: `ollama-msg-wrapper ${role}` });
		const bubble = msgEl.createDiv({ cls: `ollama-bubble ${role}` });
		
		if (role === "bot") {
			this.setBubbleText(bubble, content);
		} else {
			bubble.textContent = content;
		}
		
		const welcome = this.chatLog.querySelector(".ollama-welcome-card");
		if (welcome) welcome.remove();
		
		this.scrollToBottom();
		return bubble;
	}
	
	private scrollToBottom() {
		const scrollArea = this.container.querySelector(".ollama-chat-scroll-area");
		if (scrollArea) {
			scrollArea.scrollTop = scrollArea.scrollHeight;
		}
	}
	
	private async sendMessage() {
		if (this.isGenerating) {
			if (this.abortController) {
				this.abortController.abort();
				this.abortController = null;
			}
			return;
		}
		
		const text = this.input.value.trim();
		const model = this.modelSelect.value;
		if (!text) return;
		if (!model) {
			new Notice("No model selected or ollama is not running.");
			return;
		}
		
		this.input.value = "";
		(this.input.style as unknown as Record<string, string>).height = "auto";
		this.sendBtn.disabled = true;
		
		this.appendMessage("user", text);
		this.history.push({ role: "user", content: text });
		
		this.isGenerating = true;
		this.sendBtn.empty();
		this.sendBtn.createDiv({ cls: "ollama-stop-square" });
		this.sendBtn.disabled = false;
		this.sendBtn.classList.add("is-generating");
		
		const botBubble = this.appendMessage("bot", "");
		botBubble.empty();
		botBubble.createSpan({ cls: "ollama-typing-dot" });
		botBubble.createSpan({ cls: "ollama-typing-dot" });
		botBubble.createSpan({ cls: "ollama-typing-dot" });
		
		let fullResponse = "";
		this.abortController = new AbortController();
		
		try {
			const baseUrl = this.plugin.settings.ollamaApiUrl.replace(/\/$/, "");
			const res = await activeWindow.fetch(`${baseUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: model,
					messages: this.history,
					stream: true
				}),
				signal: this.abortController.signal
			});
			
			if (!res.ok) throw new Error(`Ollama API Error: ${res.status}`);
			if (!res.body) throw new Error("No response body");
			
			botBubble.empty();
			const reader = res.body.getReader();
			const decoder = new TextDecoder("utf-8");
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n");
				
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const parsed = JSON.parse(line) as { message?: { content?: string } };
						if (parsed.message?.content) {
							fullResponse += parsed.message.content;
							this.setBubbleText(botBubble, fullResponse);
							this.scrollToBottom();
						}
					} catch {
						// parse error on chunk boundary, ignore for now
					}
				}
			}
			
			this.history.push({ role: "assistant", content: fullResponse });
		} catch (err: unknown) {
			if (err instanceof Error && err.name === "AbortError") {
				botBubble.createEl("br");
				botBubble.createEl("em", { text: "[generation stopped]" });
				this.history.push({ role: "assistant", content: fullResponse });
			} else {
				botBubble.empty();
				const msg = err instanceof Error ? err.message : String(err);
				botBubble.createSpan({ text: `Error connecting to Ollama: ${msg}` });
				((botBubble.lastChild as HTMLElement).style as unknown as Record<string, string>).color = "var(--text-error)";
				console.error(err);
			}
		} finally {
			this.isGenerating = false;
			this.abortController = null;
			this.sendBtn.empty();
			setIcon(this.sendBtn, "send");
			this.sendBtn.classList.remove("is-generating");
			this.input.dispatchEvent(new Event("input"));
		}
	}
	
	public getSelectedText(): string {
		const selection = activeWindow.getSelection();
		return selection ? selection.toString() : "";
	}

	public reload(): void {
		void this.fetchModels();
	}
}
