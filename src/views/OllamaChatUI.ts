import { Notice } from "obsidian";
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
		this.fetchModels();
	}
	
	private render() {
		this.container.innerHTML = `
			<div class="ollama-glass-header">
				<div class="ollama-header-title">
					<div class="ollama-glow-dot"></div>
					<span class="ollama-gradient-text">Ollama Local</span>
				</div>
				<div class="ollama-select-wrapper">
					<select class="ollama-model-select">
						<option value="">No models found</option>
					</select>
					<div class="ollama-select-arrow"></div>
				</div>
			</div>
			
			<div class="ollama-chat-scroll-area">
				<div class="ollama-chat-log">
					<div class="ollama-welcome-card">
						<h4>Welcome to Local AI</h4>
						<p>Fully private, running right on your machine.</p>
					</div>
				</div>
			</div>
			
			<div class="ollama-input-container">
				<div class="ollama-input-glass">
					<textarea class="ollama-input-box" placeholder="Ask Ollama anything..." rows="1"></textarea>
					<button class="ollama-send-btn" disabled>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="22" y1="2" x2="11" y2="13"></line>
							<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
						</svg>
					</button>
				</div>
				<div class="ollama-footer-text">Powered by Ollama API at <span class="ollama-api-url-text"></span></div>
			</div>
		`;
		
		this.modelSelect = this.container.querySelector(".ollama-model-select") as HTMLSelectElement;
		this.chatLog = this.container.querySelector(".ollama-chat-log") as HTMLElement;
		this.input = this.container.querySelector(".ollama-input-box") as HTMLTextAreaElement;
		this.sendBtn = this.container.querySelector(".ollama-send-btn") as HTMLButtonElement;
		
		const footerText = this.container.querySelector(".ollama-api-url-text");
		if (footerText) footerText.textContent = this.plugin.settings.ollamaApiUrl;
		
		this.setupListeners();
	}
	
	private setupListeners() {
		this.input.addEventListener("input", () => {
			this.input.style.height = "auto";
			this.input.style.height = Math.min(this.input.scrollHeight, 120) + "px";
			this.sendBtn.disabled = this.input.value.trim() === "" || this.isGenerating;
		});
		
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		});
		
		this.sendBtn.addEventListener("click", () => this.sendMessage());
	}
	
	private async fetchModels() {
		try {
			const baseUrl = this.plugin.settings.ollamaApiUrl.replace(/\/$/, "");
			const res = await fetch(`${baseUrl}/api/tags`);
			if (!res.ok) throw new Error("Failed to fetch models");
			const data = await res.json();
			if (data.models && data.models.length > 0) {
				this.modelSelect.innerHTML = "";
				for (const m of data.models) {
					const opt = document.createElement("option");
					opt.value = m.name;
					opt.textContent = m.name;
					this.modelSelect.appendChild(opt);
				}
			}
		} catch (err) {
			this.modelSelect.innerHTML = `<option value="">Ollama not running?</option>`;
		}
	}
	
	public injectContext(text: string) {
		this.input.value = this.input.value + text;
		this.input.dispatchEvent(new Event("input"));
		this.input.focus();
	}
	
	private appendMessage(role: "user" | "bot", content: string): HTMLElement {
		const msgEl = document.createElement("div");
		msgEl.className = `ollama-msg-wrapper ${role}`;
		
		const bubble = document.createElement("div");
		bubble.className = `ollama-bubble ${role}`;
		
		if (role === "bot") {
			// For simplicity we just use basic line breaks for now, 
			// the plugin's save logic handles markdown later.
			bubble.innerHTML = this.escapeHtml(content).replace(/\n/g, "<br>");
		} else {
			bubble.textContent = content;
		}
		
		msgEl.appendChild(bubble);
		
		// Remove welcome card on first message
		const welcome = this.chatLog.querySelector(".ollama-welcome-card");
		if (welcome) welcome.remove();
		
		this.chatLog.appendChild(msgEl);
		this.scrollToBottom();
		return bubble;
	}
	
	private scrollToBottom() {
		const scrollArea = this.container.querySelector(".ollama-chat-scroll-area");
		if (scrollArea) {
			scrollArea.scrollTop = scrollArea.scrollHeight;
		}
	}
	
	private escapeHtml(unsafe: string) {
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;");
	}
	
	private async sendMessage() {
		if (this.isGenerating) {
			// Allow stopping generation
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
			new Notice("No model selected or Ollama is not running.");
			return;
		}
		
		this.input.value = "";
		this.input.style.height = "auto";
		this.sendBtn.disabled = true;
		
		this.appendMessage("user", text);
		this.history.push({ role: "user", content: text });
		
		this.isGenerating = true;
		this.sendBtn.innerHTML = `<div class="ollama-stop-square"></div>`;
		this.sendBtn.disabled = false;
		this.sendBtn.classList.add("is-generating");
		
		const botBubble = this.appendMessage("bot", "");
		botBubble.innerHTML = `<span class="ollama-typing-dot"></span><span class="ollama-typing-dot"></span><span class="ollama-typing-dot"></span>`;
		
		let fullResponse = "";
		this.abortController = new AbortController();
		
		try {
			const baseUrl = this.plugin.settings.ollamaApiUrl.replace(/\/$/, "");
			const res = await fetch(`${baseUrl}/api/chat`, {
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
			
			botBubble.innerHTML = "";
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
						const parsed = JSON.parse(line);
						if (parsed.message?.content) {
							fullResponse += parsed.message.content;
							botBubble.innerHTML = this.escapeHtml(fullResponse).replace(/\n/g, "<br>");
							this.scrollToBottom();
						}
					} catch (e) {
						// parse error on chunk boundary, ignore for now
					}
				}
			}
			
			this.history.push({ role: "assistant", content: fullResponse });
		} catch (err: any) {
			if (err.name === "AbortError") {
				botBubble.innerHTML += "<br><em>[Generation stopped]</em>";
				this.history.push({ role: "assistant", content: fullResponse });
			} else {
				botBubble.innerHTML = `<span style="color:var(--text-error)">Error connecting to Ollama: ${err.message}</span>`;
				console.error(err);
			}
		} finally {
			this.isGenerating = false;
			this.abortController = null;
			this.sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
			this.sendBtn.classList.remove("is-generating");
			this.input.dispatchEvent(new Event("input")); // update disabled state
		}
	}
	
	public getSelectedText(): string {
		// Just a mockup since webviews have executeJavaScript, but for native we just return empty
		// since we don't have a webview. Users can just copy paste natively.
		const selection = window.getSelection();
		return selection ? selection.toString() : "";
	}
}
