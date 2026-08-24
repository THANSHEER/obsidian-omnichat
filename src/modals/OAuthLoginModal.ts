import { App, Modal, Notice } from "obsidian";
import { getCleanUserAgent, getChromeStealthScript } from "../utils";

type EmbeddedWebview = HTMLElement & {
	src: string;
	executeJavaScript?: (code: string) => Promise<unknown>;
};

export class OAuthLoginModal extends Modal {
	private authUrl: string;
	private targetServiceUrl: string;
	private onSuccess: () => void;
	private customUserAgent?: string;
	private webview: EmbeddedWebview | null = null;
	private isCompleted = false;
	private completeTimer: number | null = null;

	constructor(
		app: App,
		authUrl: string,
		targetServiceUrl: string,
		onSuccess: () => void,
		customUserAgent?: string,
	) {
		super(app);
		this.authUrl = authUrl;
		this.targetServiceUrl = targetServiceUrl;
		this.onSuccess = onSuccess;
		this.customUserAgent = customUserAgent;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		modalEl.addClass("oc-oauth-modal-window");
		contentEl.addClass("oc-oauth-modal-content");

		// Header
		const header = contentEl.createDiv({ cls: "oc-oauth-header" });
		header.createEl("h3", { text: "Sign in", cls: "oc-oauth-title" });
		header.createEl("p", {
			text: "Sign in with your account. This window will automatically close and refresh your chat once complete.",
			cls: "oc-oauth-subtitle",
		});

		// Loading indicator
		const loadingBar = contentEl.createDiv({ cls: "oc-oauth-loading" });
		loadingBar.createDiv({ cls: "ai-chat-loading-spinner" });

		// Webview Container
		const frame = contentEl.createDiv({ cls: "oc-oauth-frame" });

		const wv = frame.createEl("webview" as keyof HTMLElementTagNameMap) as EmbeddedWebview;
		wv.className = "oc-oauth-webview";
		wv.setAttribute("partition", "persist:aibrowser-chat");
		wv.setAttribute("allowpopups", "");
		wv.setAttribute("webpreferences", "contextIsolation=yes");
		wv.setAttribute("useragent", getCleanUserAgent(this.customUserAgent));
		wv.src = this.authUrl;

		wv.addEventListener("did-start-loading", () => {
			loadingBar.show();
		});

		wv.addEventListener("did-stop-loading", () => {
			loadingBar.hide();
		});

		wv.addEventListener("dom-ready", () => {
			loadingBar.hide();
			if (wv.executeJavaScript) {
				void wv.executeJavaScript(getChromeStealthScript());
			}
		});

		const checkAuthCompletion = (currentUrl: string): void => {
			if (this.isCompleted || !currentUrl) return;

			try {
				const current = new URL(currentUrl);
				const target = new URL(this.targetServiceUrl);

				// If navigation has reached the target host outside of standard external OAuth domains
				const isTargetHost = current.hostname.endsWith(target.hostname) || target.hostname.endsWith(current.hostname);
				const isOAuthDomain =
					/accounts\.google\.|appleid\.apple|login\.microsoft|login\.live|auth0\.com|clerk\./i.test(current.hostname);

				if (isTargetHost && !isOAuthDomain) {
					this.isCompleted = true;
					if (this.completeTimer !== null) window.clearTimeout(this.completeTimer);
					this.completeTimer = window.setTimeout(() => {
						this.close();
						this.onSuccess();
						new Notice("Signed in successfully.");
					}, 800);
				}
			} catch {
				// Ignore parsing errors for intermediate data/about URLs
			}
		};

		wv.addEventListener("did-navigate", (e: Event) => {
			const ev = e as Event & { url?: string };
			if (typeof ev.url === "string") checkAuthCompletion(ev.url);
		});

		wv.addEventListener("did-navigate-in-page", (e: Event) => {
			const ev = e as Event & { url?: string };
			if (typeof ev.url === "string") checkAuthCompletion(ev.url);
		});

		wv.addEventListener("close", () => {
			if (!this.isCompleted) {
				this.isCompleted = true;
				this.close();
				this.onSuccess();
			}
		});

		wv.addEventListener("new-window", (e: Event) => {
			const ev = e as Event & { url?: string };
			if (typeof ev.url === "string") {
				wv.src = ev.url;
			}
		});

		this.webview = wv;

		// Footer Actions
		const footer = contentEl.createDiv({ cls: "oc-oauth-footer" });
		const cancelBtn = footer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const doneBtn = footer.createEl("button", { text: "I'm signed in (done)", cls: "mod-cta" });
		doneBtn.addEventListener("click", () => {
			this.isCompleted = true;
			this.close();
			this.onSuccess();
			new Notice("Reloading chat with signed-in session…");
		});
	}

	onClose(): void {
		if (this.completeTimer !== null) {
			window.clearTimeout(this.completeTimer);
			this.completeTimer = null;
		}
		this.webview?.remove();
		this.webview = null;
		this.contentEl.empty();
	}
}
