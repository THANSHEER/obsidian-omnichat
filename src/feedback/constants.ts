/** Geekstash Forms — product slug for OmniChat. */
export const PRODUCT_SLUG = "omnichat";

export const GITHUB_REPO = "THANSHEER/obsidian-omnichat";

/**
 * Plugins must not call api.geekstash.dev or embed Turnstile directly
 * (see CLAUDE.md). Forms are hosted on the website and opened in the user's
 * default browser instead.
 */
export const SITE_BASE_URL = "https://geekstash.dev";

export type ProductForm = "uninstall" | "feedback" | "bug-report" | "feature-request";

/** Build the hosted form URL for this product. Mirrors `productFormSiteUrl()`. */
export function productFormSiteUrl(form: ProductForm, opts?: { topic?: string }): string {
	const url = `${SITE_BASE_URL}/${PRODUCT_SLUG}/${form}`;
	if (form === "feedback" && opts?.topic) {
		return `${url}?topic=${encodeURIComponent(opts.topic)}`;
	}
	return url;
}
