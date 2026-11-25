export interface ApiChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface StreamApiOptions {
	onChunk: (text: string) => void;
	onDone: (fullText: string) => void;
	onError: (err: string) => void;
	signal?: AbortSignal;
}

export interface AnthropicStreamOptions extends StreamApiOptions {
	apiKey: string;
	model: string;
	messages: ApiChatMessage[];
	systemPrompt?: string;
}

export interface OpenAIStreamOptions extends StreamApiOptions {
	apiKey: string;
	baseUrl?: string;
	model: string;
	messages: ApiChatMessage[];
	systemPrompt?: string;
}

export interface OllamaStreamOptions extends StreamApiOptions {
	baseUrl: string;
	model: string;
	messages: ApiChatMessage[];
}

/** Stream messages from Anthropic Messages API. */
export async function streamAnthropic(options: AnthropicStreamOptions): Promise<void> {
	const { apiKey, model, messages, systemPrompt, onChunk, onDone, onError, signal } = options;

	if (!apiKey?.trim()) {
		onError("Anthropic API key is required. Please set it in OmniChat settings under Agent CLI & API.");
		return;
	}

	try {
		const payload: Record<string, unknown> = {
			model: model || "claude-3-7-sonnet-latest",
			max_tokens: 4096,
			stream: true,
			messages: messages.map((m) => ({
				role: m.role === "system" ? "user" : m.role,
				content: m.content,
			})),
		};

		if (systemPrompt?.trim()) {
			payload.system = systemPrompt.trim();
		}

		const res = await activeWindow.fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey.trim(),
				"anthropic-version": "2023-06-01",
				"dangerously-allow-browser": "true",
			},
			body: JSON.stringify(payload),
			signal,
		});

		if (!res.ok) {
			const errorBody = await res.text();
			let detail = errorBody;
			try {
				const parsed = JSON.parse(errorBody) as { error?: { message?: string } };
				if (parsed.error?.message) detail = parsed.error.message;
			} catch {
				// Use raw text
			}
			onError(`Anthropic API Error (${String(res.status)}): ${detail}`);
			return;
		}

		if (!res.body) {
			onError("No response body received from Anthropic API.");
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let fullResponse = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const dataStr = trimmed.substring(5).trim();
				if (!dataStr) continue;

				try {
					const event = JSON.parse(dataStr) as {
						type?: string;
						delta?: { type?: string; text?: string };
					};

					if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
						const chunk = event.delta.text ?? "";
						if (chunk) {
							fullResponse += chunk;
							onChunk(chunk);
						}
					}
				} catch {
					// Ignore partial json parse error
				}
			}
		}

		onDone(fullResponse);
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") {
			return;
		}
		const msg = e instanceof Error ? e.message : String(e);
		onError(`Anthropic request failed: ${msg}`);
	}
}

/** Stream chat completions from OpenAI or OpenAI-compatible endpoint. */
export async function streamOpenAI(options: OpenAIStreamOptions): Promise<void> {
	const { apiKey, baseUrl, model, messages, systemPrompt, onChunk, onDone, onError, signal } = options;

	const targetBase = (baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

	try {
		const formattedMessages: { role: string; content: string }[] = [];
		if (systemPrompt?.trim()) {
			formattedMessages.push({ role: "system", content: systemPrompt.trim() });
		}
		for (const m of messages) {
			formattedMessages.push({ role: m.role, content: m.content });
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (apiKey?.trim()) {
			headers.Authorization = `Bearer ${apiKey.trim()}`;
		}

		const res = await activeWindow.fetch(`${targetBase}/chat/completions`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				model: model || "gpt-4o",
				messages: formattedMessages,
				stream: true,
			}),
			signal,
		});

		if (!res.ok) {
			const errorBody = await res.text();
			let detail = errorBody;
			try {
				const parsed = JSON.parse(errorBody) as { error?: { message?: string } };
				if (parsed.error?.message) detail = parsed.error.message;
			} catch {
				// Use raw text
			}
			onError(`OpenAI API Error (${String(res.status)}): ${detail}`);
			return;
		}

		if (!res.body) {
			onError("No response body received from OpenAI API.");
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let fullResponse = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const dataStr = trimmed.substring(5).trim();
				if (!dataStr || dataStr === "[DONE]") continue;

				try {
					const event = JSON.parse(dataStr) as {
						choices?: { delta?: { content?: string } }[];
					};
					const chunk = event.choices?.[0]?.delta?.content;
					if (chunk) {
						fullResponse += chunk;
						onChunk(chunk);
					}
				} catch {
					// Ignore partial json parse error
				}
			}
		}

		onDone(fullResponse);
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") {
			return;
		}
		const msg = e instanceof Error ? e.message : String(e);
		onError(`OpenAI request failed: ${msg}`);
	}
}

/** Stream response from local or remote Ollama server. */
export async function streamOllama(options: OllamaStreamOptions): Promise<void> {
	const { baseUrl, model, messages, onChunk, onDone, onError, signal } = options;

	const targetBase = (baseUrl?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");

	try {
		const res = await activeWindow.fetch(`${targetBase}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				messages: messages.map((m) => ({ role: m.role, content: m.content })),
				stream: true,
			}),
			signal,
		});

		if (!res.ok) {
			onError(`Ollama API Error (${String(res.status)})`);
			return;
		}

		if (!res.body) {
			onError("No response body received from Ollama.");
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let fullResponse = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const event = JSON.parse(trimmed) as {
						message?: { content?: string };
					};
					const chunk = event.message?.content;
					if (chunk) {
						fullResponse += chunk;
						onChunk(chunk);
					}
				} catch {
					// Ignore partial json parse error
				}
			}
		}

		onDone(fullResponse);
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") {
			return;
		}
		const msg = e instanceof Error ? e.message : String(e);
		onError(`Ollama request failed: ${msg}`);
	}
}

/** Fetch available models from an Ollama instance. */
export async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
	try {
		const targetBase = (baseUrl?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
		const res = await activeWindow.fetch(`${targetBase}/api/tags`);
		if (!res.ok) return [];
		const data = (await res.json()) as { models?: { name: string }[] };
		return (data.models ?? []).map((m) => m.name).filter(Boolean);
	} catch {
		return [];
	}
}
