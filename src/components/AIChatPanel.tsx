import React, { useEffect, useRef, useState } from "react";
import { App, Notice, TFile, TFolder } from "obsidian";
import { SERVICE_URLS, ServiceKey } from "../constants";
import { FilePickerModal } from "../modals/FilePickerModal";
import { FolderPickerModal } from "../modals/FolderPickerModal";
import { ContextItem, ThemeMode, PromptTemplate } from "../settings";
import { normalizeUrl, getServiceKey, firstEnabled, buildContextString, stripFrontmatterContent } from "../utils";

export interface AIChatPanelProps {
	app: App;
	webAppUrl: string;
	maxContextLength: number;
	enableChatGPT: boolean;
	enableClaude: boolean;
	enableDeepSeek: boolean;
	enablePerplexity: boolean;
	enableGemini: boolean;
	enableGrok: boolean;
	enableCopilot: boolean;
	enableManus: boolean;
	enableKimi: boolean;
	autoRefreshMinutes: number;
	autoClearContext: boolean;
	contextPrefix: string;
	initialContextItems?: ContextItem[];
	onContextItemsChange?: (items: ContextItem[]) => void;
	onUrlChange?: (url: string) => void;
	pendingText?: string | null;
	onPendingTextHandled?: () => void;
	theme?: ThemeMode;
	promptTemplates: PromptTemplate[];
	autoContextOnOpen: boolean;
	stripFrontmatter: boolean;
	saveNoteFolder: string;
}

type EmbeddedWebviewElement = HTMLElement & {
	src: string;
	executeJavaScript?: (code: string) => Promise<unknown>;
	goBack?: () => void;
	goForward?: () => void;
	canGoBack?: () => boolean;
	canGoForward?: () => boolean;
};


export function AIChatPanel({
	app,
	webAppUrl,
	maxContextLength,
	enableChatGPT,
	enableClaude,
	enableDeepSeek,
	enablePerplexity,
	enableGemini,
	enableGrok,
	enableCopilot,
	enableManus,
	enableKimi,
	autoRefreshMinutes,
	autoClearContext,
	contextPrefix,
	initialContextItems = [],
	onContextItemsChange,
	onUrlChange,
	pendingText = null,
	onPendingTextHandled,
	theme = "auto",
	promptTemplates,
	autoContextOnOpen,
	stripFrontmatter,
	saveNoteFolder,
}: AIChatPanelProps): React.JSX.Element {
	const hostRef             = useRef<HTMLDivElement | null>(null);
	const webviewRef          = useRef<EmbeddedWebviewElement | null>(null);
	const readyRef            = useRef(false);
	const lastInteractedAtRef = useRef<number>(Date.now());

	const [isLoading, setIsLoading]               = useState(true);
	const [webviewSupported, setWebviewSupported] = useState(true);
	const [items, setItems]                       = useState<ContextItem[]>(initialContextItems);
	const [isAdding, setIsAdding]                 = useState(false);
	const [showContextList, setShowContextList]   = useState(false);
	const [canGoBack, setCanGoBack]               = useState(false);
	const [canGoForward, setCanGoForward]         = useState(false);
	const [isExpanded, setIsExpanded]             = useState(false);
	const [showTemplates, setShowTemplates]       = useState(false);

	const enabledFlags: Record<ServiceKey, boolean> = {
		chatgpt:    enableChatGPT,
		claude:     enableClaude,
		deepseek:   enableDeepSeek,
		perplexity: enablePerplexity,
		gemini:     enableGemini,
		grok:       enableGrok,
		copilot:    enableCopilot,
		manus:      enableManus,
		kimi:       enableKimi,
	};

	const [activeUrl, setActiveUrl] = useState(() => {
		const normalized = normalizeUrl(webAppUrl);
		const key = getServiceKey(normalized);
		if (key && !enabledFlags[key]) {
			const fallback = firstEnabled(enabledFlags);
			return fallback ? SERVICE_URLS[fallback] : normalized;
		}
		return normalized;
	});

	const activeService = getServiceKey(activeUrl);

	// If the active service gets disabled, auto-switch to the first enabled one.
	useEffect(() => {
		if (activeService && !enabledFlags[activeService]) {
			const fallback = firstEnabled(enabledFlags);
			if (fallback) {
				const newUrl = SERVICE_URLS[fallback];
				setActiveUrl(newUrl);
				onUrlChange?.(newUrl);
			}
		}
	}, [enableChatGPT, enableClaude, enableDeepSeek, enablePerplexity, enableGemini, enableGrok, enableCopilot, enableManus, enableKimi]);

	useEffect(() => {
		onContextItemsChange?.(items);
	}, [items, onContextItemsChange]);

	useEffect(() => {
		setActiveUrl(normalizeUrl(webAppUrl));
	}, [webAppUrl]);

	// Auto-add active note to context when panel first opens.
	useEffect(() => {
		if (!autoContextOnOpen) return;
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) return;
		setItems((prev) => {
			if (prev.some((i) => i.path === activeFile.path)) return prev;
			return [...prev, { path: activeFile.path, type: "file", displayName: activeFile.basename }];
		});
	}, []);

	// Create the webview element imperatively — React cannot render <webview> reliably.
	useEffect(() => {
		const host = hostRef.current;
		if (!host || webviewRef.current) return;

		host.replaceChildren();

		// eslint-disable-next-line obsidianmd/prefer-active-doc -- webview must use document.createElement; activeDocument does not support custom elements
		const webview = document.createElement("webview") as EmbeddedWebviewElement;
		webview.className = "ai-chat-browser-webview";
		webview.setAttribute("partition", "persist:aibrowser-chat");
		webview.setAttribute("allowpopups", "");
		webview.setAttribute("webpreferences", "contextIsolation=yes");
		// Override the UA so sites don't detect the Electron webview environment.
		webview.setAttribute("useragent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
		webview.src = activeUrl;

		const refreshNavState = (): void => {
			setCanGoBack(webview.canGoBack?.() ?? false);
			setCanGoForward(webview.canGoForward?.() ?? false);
			lastInteractedAtRef.current = Date.now();
		};

		const onReady      = (): void => { readyRef.current = true; setWebviewSupported(true); setIsLoading(false); refreshNavState(); };
		const onLoadStart  = (): void => { setIsLoading(true); };
		const onLoadStop   = (): void => { setIsLoading(false); refreshNavState(); };
		const onLoadFailed = (): void => { setWebviewSupported(false); setIsLoading(false); };

		webview.addEventListener("dom-ready",            onReady     );
		webview.addEventListener("did-start-loading",    onLoadStart );
		webview.addEventListener("did-stop-loading",     onLoadStop  );
		webview.addEventListener("did-fail-load",        onLoadFailed);
		webview.addEventListener("did-navigate",         refreshNavState);
		webview.addEventListener("did-navigate-in-page", refreshNavState);

		host.appendChild(webview);
		webviewRef.current = webview;

		return () => {
			webview.removeEventListener("dom-ready",            onReady     );
			webview.removeEventListener("did-start-loading",    onLoadStart );
			webview.removeEventListener("did-stop-loading",     onLoadStop  );
			webview.removeEventListener("did-fail-load",        onLoadFailed);
			webview.removeEventListener("did-navigate",         refreshNavState);
			webview.removeEventListener("did-navigate-in-page", refreshNavState);
			webview.remove();
			webviewRef.current = null;
			readyRef.current   = false;
		};
	}, []);

	// Update webview src when the active URL changes.
	useEffect(() => {
		const webview = webviewRef.current;
		if (!webview || webview.src === activeUrl) return;
		readyRef.current = false;
		setWebviewSupported(true);
		setIsLoading(true);
		webview.src = activeUrl;
	}, [activeUrl]);

	// Idle-refresh: silently reload after the configured idle period.
	useEffect(() => {
		if (autoRefreshMinutes <= 0) return;
		const intervalMs = autoRefreshMinutes * 60 * 1000;
		const timer = window.setInterval(() => {
			const idle = Date.now() - lastInteractedAtRef.current;
			if (idle >= intervalMs && readyRef.current) {
				const webview = webviewRef.current;
				if (webview) {
					readyRef.current = false;
					setIsLoading(true);
					const reloadSrc = webview.src;
					webview.src = reloadSrc;
					lastInteractedAtRef.current = Date.now();
				}
			}
		}, 60_000);
		return () => window.clearInterval(timer);
	}, [autoRefreshMinutes]);

	// Inject selected text sent from the command palette.
	useEffect(() => {
		if (!pendingText) return;
		void (async () => {
			const injected = await injectIntoWebview(pendingText);
			if (injected) {
				new Notice("Selection sent to AI.");
			} else {
				await navigator.clipboard.writeText(pendingText);
				new Notice("Selection copied — paste with Cmd+V / Ctrl+V.");
			}
			onPendingTextHandled?.();
		})();
	}, [pendingText]);

	// ── Helpers ────────────────────────────────────────────────

	async function injectIntoWebview(text: string): Promise<boolean> {
		const webview = webviewRef.current;
		if (!webview?.executeJavaScript) return false;
		try {
			const json = JSON.stringify(text);
			const result = await webview.executeJavaScript(`
				(function(ctx) {
					// Ordered by specificity — most reliable selectors first.
					var selectors = [
						'#prompt-textarea',
						'[contenteditable="true"][aria-label]',
						'div[contenteditable="true"].ql-editor',
						'textarea',
						'[contenteditable="true"]'
					];
					var el = null;
					for (var i = 0; i < selectors.length; i++) {
						var f = document.querySelector(selectors[i]);
						if (f) { el = f; break; }
					}
					if (!el) return false;
					el.focus();

					if (el.tagName === 'TEXTAREA') {
						// Use native value setter so React's synthetic event system sees the change.
						var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
						if (desc && desc.set) {
							desc.set.call(el, el.value + ctx);
						} else {
							el.value = el.value + ctx;
						}
						el.dispatchEvent(new Event('input', { bubbles: true }));
						el.dispatchEvent(new Event('change', { bubbles: true }));
						return true;
					}

					// contenteditable — execCommand works in Electron Chromium.
					var ok = document.execCommand('insertText', false, ctx);
					if (!ok) {
						// Paste-event fallback for services that intercept clipboard.
						try {
							var dt = new DataTransfer();
							dt.setData('text/plain', ctx);
							el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
						} catch(e) { return false; }
					}
					el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: ctx }));
					return true;
				})(${json})
			`);
			return result === true;
		} catch {
			return false;
		}
	}

	// ── Actions ────────────────────────────────────────────────

	function switchService(key: ServiceKey): void {
		const newUrl = SERVICE_URLS[key];
		setActiveUrl(newUrl);
		onUrlChange?.(newUrl);
	}

	function reloadWebview(): void {
		const webview = webviewRef.current;
		if (!webview) return;
		readyRef.current = false;
		setWebviewSupported(true);
		setIsLoading(true);
		const reloadSrc = webview.src;
		webview.src = reloadSrc;
		lastInteractedAtRef.current = Date.now();
	}

	function goBack(): void {
		webviewRef.current?.goBack?.();
	}

	function goForward(): void {
		webviewRef.current?.goForward?.();
	}

	function addActiveFile(): void {
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) { new Notice("No active file."); return; }
		setItems((prev) => {
			if (prev.some((i) => i.path === activeFile.path)) {
				new Notice("Already in context.");
				return prev;
			}
			setShowContextList(true);
			return [...prev, { path: activeFile.path, type: "file", displayName: activeFile.basename }];
		});
	}

	function addAllOpenFiles(): void {
		const openFiles = app.workspace
			.getLeavesOfType("markdown")
			.map((leaf) => (leaf.view as unknown as { file?: TFile }).file)
			.filter((file): file is TFile => file instanceof TFile);

		if (openFiles.length === 0) { new Notice("No open Markdown files."); return; }

		setItems((prev) => {
			let added = 0;
			const next = [...prev];
			for (const file of openFiles) {
				if (!next.some((i) => i.path === file.path)) {
					next.push({ path: file.path, type: "file", displayName: file.basename });
					added++;
				}
			}
			if (added > 0) {
				new Notice(`Added ${added} file${added !== 1 ? "s" : ""} to context.`);
				setShowContextList(true);
			} else {
				new Notice("All open files already in context.");
			}
			return next;
		});
	}

	function addFile(): void {
		new FilePickerModal(app, (file: TFile) => {
			setItems((prev) => {
				if (prev.some((i) => i.path === file.path)) return prev;
				return [...prev, { path: file.path, type: "file", displayName: file.basename }];
			});
			setShowContextList(true);
		}).open();
	}

	function addFolder(): void {
		new FolderPickerModal(app, (folder: TFolder) => {
			setItems((prev) => {
				if (prev.some((i) => i.path === folder.path)) return prev;
				const displayName = folder.isRoot() ? "Vault root" : folder.name;
				return [...prev, { path: folder.path, type: "folder", displayName }];
			});
			setShowContextList(true);
		}).open();
	}

	function removeItem(path: string): void {
		setItems((prev) => prev.filter((i) => i.path !== path));
	}

	function clearAll(): void {
		setItems([]);
		setShowContextList(false);
	}

	async function applyTemplate(text: string): Promise<void> {
		setShowTemplates(false);
		if (!text.trim()) { new Notice("This template is empty — edit it in settings."); return; }
		const injected = await injectIntoWebview(text);
		if (!injected) {
			await navigator.clipboard.writeText(text);
			new Notice("Template copied — paste with Cmd+V / Ctrl+V.");
		}
	}

	async function saveClipboardAsNote(): Promise<void> {
		const text = await navigator.clipboard.readText();
		if (!text.trim()) { new Notice("Clipboard is empty — copy an AI response first."); return; }
		const folder = saveNoteFolder.trim() || "AI Notes";
		if (!app.vault.getAbstractFileByPath(folder)) {
			await app.vault.createFolder(folder);
		}
		const now = new Date();
		const pad = (n: number): string => String(n).padStart(2, "0");
		const name = `AI Response ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		const path = `${folder}/${name}.md`;
		const file = await app.vault.create(path, text);
		new Notice(`Saved to ${file.path}`);
		const leaf = app.workspace.getLeaf(false);
		if (leaf) await leaf.openFile(file);
	}

	async function handleAddContext(): Promise<void> {
		if (items.length === 0) { new Notice("Add some notes to context first."); return; }

		setIsAdding(true);

		try {
			const parts: string[] = [];

			for (const item of items) {
				const node = app.vault.getAbstractFileByPath(item.path);
				if (item.type === "file" && node instanceof TFile) {
					const raw = await app.vault.read(node);
					const content = stripFrontmatter ? stripFrontmatterContent(raw) : raw;
					parts.push(`## Note: ${node.basename}\n\n${content}`);
				} else if (item.type === "folder" && node instanceof TFolder) {
					const files: TFile[] = [];
					const traverse = (f: TFolder): void => {
						for (const child of f.children) {
							if (child instanceof TFile && child.extension === "md") files.push(child);
							else if (child instanceof TFolder) traverse(child);
						}
					};
					traverse(node);
					for (const file of files) {
						const raw = await app.vault.read(file);
						const content = stripFrontmatter ? stripFrontmatterContent(raw) : raw;
						parts.push(`## Note: ${file.basename}\n\n${content}`);
					}
				}
			}

			if (parts.length === 0) { new Notice("No readable notes found."); return; }

			const { text: fullText, truncated } = buildContextString(parts, maxContextLength, contextPrefix);
			if (truncated) new Notice("Context truncated — limit reached.");

			const injected = await injectIntoWebview(fullText);
			if (injected) {
				new Notice("Context pasted in chat.");
			} else {
				await navigator.clipboard.writeText(fullText);
				new Notice("Context copied to clipboard — paste with Cmd+V / Ctrl+V.");
			}

			if (autoClearContext) clearAll();
		} finally {
			setIsAdding(false);
		}
	}

	// ── Render ─────────────────────────────────────────────────

	const hasServices = enableChatGPT || enableClaude || enableDeepSeek || enablePerplexity || enableGemini || enableGrok || enableCopilot || enableManus || enableKimi;
	const hasItems    = items.length > 0;

	return (
		<div
			className={`ai-chat-app${isExpanded ? " is-expanded" : ""}`}
			{...(theme !== "auto" ? { "data-cp-theme": theme } : {})}
		>
			<header className="vc-header">

				{/* Row 1 — Navigation + Service selector + Expand */}
				{hasServices && (
					<div className="vc-service-row">
						<button
							className="vc-nav-btn"
							onClick={goBack}
							disabled={!canGoBack}
							title="Go back"
							aria-label="Back"
						>‹</button>
						<button
							className="vc-nav-btn"
							onClick={goForward}
							disabled={!canGoForward}
							title="Go forward"
							aria-label="Forward"
						>›</button>

						<span
							className={`vc-svc-dot vc-svc-dot--${activeService ?? "none"}`}
							aria-hidden="true"
						/>
						<div className="vc-select-wrap">
							<select
								className="vc-service-select"
								value={activeService ?? ""}
								onChange={(e) => {
									const val = e.target.value as ServiceKey;
									if (val in SERVICE_URLS) switchService(val);
								}}
								aria-label="Select AI service"
							>
								{enableChatGPT    && <option value="chatgpt">ChatGPT</option>}
								{enableClaude     && <option value="claude">Claude</option>}
								{enableDeepSeek   && <option value="deepseek">DeepSeek</option>}
								{enablePerplexity && <option value="perplexity">Perplexity</option>}
								{enableGemini     && <option value="gemini">Gemini</option>}
								{enableGrok       && <option value="grok">Grok</option>}
								{enableCopilot    && <option value="copilot">Copilot</option>}
								{enableManus      && <option value="manus">Manus AI</option>}
								{enableKimi       && <option value="kimi">Kimi</option>}
							</select>
							<span className="vc-select-caret" aria-hidden="true" />
						</div>
						{isLoading ? (
							<span className="vc-loading-pip" aria-label="Loading" />
						) : (
							<button
								className="vc-reload-btn"
								onClick={reloadWebview}
								title="Reload the AI page"
								aria-label="Reload"
							>↺</button>
						)}
						<button
							className="vc-expand-btn"
							onClick={() => setIsExpanded((v) => !v)}
							title={isExpanded ? "Collapse panel" : "Expand panel"}
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							{isExpanded ? "⊡" : "⊞"}
						</button>
					</div>
				)}

				{/* Row 2 — Context bar */}
				<div className="vc-context-bar">
					<div className="vc-ctx-actions">
						<button className="vc-ctx-btn" onClick={addActiveFile}   title="Add the currently focused note">Active</button>
						<button className="vc-ctx-btn" onClick={addAllOpenFiles} title="Add all open markdown tabs">Open</button>
						<button className="vc-ctx-btn" onClick={addFile}         title="Search and pick any vault note">+ Note</button>
						<button className="vc-ctx-btn" onClick={addFolder}       title="Add all .md files inside a folder">+ Folder</button>
						{promptTemplates.length > 0 && (
							<button
								className={`vc-ctx-btn vc-templates-btn${showTemplates ? " is-active" : ""}`}
								onClick={() => { setShowTemplates((v) => !v); setShowContextList(false); }}
								title="Insert a prompt template"
							>Templates ▾</button>
						)}
					</div>

					<div className="vc-ctx-right">
						<button
							className={`vc-ctx-count${hasItems ? " has-items" : ""}${showContextList ? " is-open" : ""}`}
							onClick={() => { setShowContextList((v) => !v); setShowTemplates(false); }}
							title={hasItems ? `${items.length} item${items.length !== 1 ? "s" : ""} — click to view` : "No items in context"}
							disabled={!hasItems}
							aria-expanded={showContextList}
						>
							{hasItems ? `${items.length} ${items.length === 1 ? "item" : "items"} ▾` : "–"}
						</button>

						<button
							className={`vc-add-btn${hasItems ? " is-ready" : ""}`}
							onClick={() => void handleAddContext()}
							disabled={isAdding || !hasItems}
							title="Paste note content into chat"
						>
							{isAdding ? "…" : "Add"}
						</button>

						<button
							className="vc-save-btn"
							onClick={() => void saveClipboardAsNote()}
							title="Save clipboard content as a new vault note"
							aria-label="Save AI response as note"
						>Save</button>
					</div>
				</div>

				{/* Prompt templates dropdown */}
				{showTemplates && promptTemplates.length > 0 && (
					<div className="vc-templates-list" role="list" aria-label="Prompt templates">
						{promptTemplates.map((t) => (
							<button
								key={t.id}
								className="vc-template-item"
								role="listitem"
								onClick={() => void applyTemplate(t.text)}
								title={t.text || "No text set"}
							>
								{t.label}
							</button>
						))}
					</div>
				)}

				{/* Context item list — animated dropdown overlay */}
				{showContextList && hasItems && (
					<div className="vc-context-list" role="list" aria-label="Context items">
						{items.map((item) => (
							<div key={item.path} className="vc-ctx-item" role="listitem">
								<span className={`vc-item-badge vc-item-badge--${item.type}`} aria-hidden="true">
									{item.type === "file" ? "F" : "D"}
								</span>
								<span className="vc-item-name" title={item.path}>{item.displayName}</span>
								<button
									className="vc-item-remove"
									onClick={() => removeItem(item.path)}
									aria-label={`Remove ${item.displayName} from context`}
								>
									×
								</button>
							</div>
						))}
						<div className="vc-ctx-list-footer">
							<button className="vc-ctx-clear-btn" onClick={clearAll}>Clear all</button>
						</div>
					</div>
				)}
			</header>

			<section className="ai-chat-browser-shell" aria-label="Embedded AI browser">
				<div className="ai-chat-browser-frame">
					<div ref={hostRef} className="ai-chat-browser-host" />
					{!webviewSupported && (
						<div className="ai-chat-browser-fallback" role="alert">
							<p>Could not load the AI service.</p>
							<p>Check your connection and ensure Obsidian's web viewer is enabled.</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
