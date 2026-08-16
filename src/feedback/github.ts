import { requestUrl } from "obsidian";
import { GITHUB_REPO } from "./constants";

export interface ReleaseNotes {
	tag: string;
	name: string;
	body: string;
	htmlUrl: string;
}

/**
 * Fetch release notes for a version tag (with or without leading `v`).
 * Returns null when that exact release is missing — does not fall back to
 * “latest”, which can show notes for a different version.
 */
export async function fetchReleaseNotes(version: string): Promise<ReleaseNotes | null> {
	const tags = version.startsWith("v") ? [version] : [`v${version}`, version];

	for (const tag of tags) {
		const notes = await fetchReleaseByTag(tag);
		if (notes) return notes;
	}

	return null;
}

async function fetchReleaseByTag(tag: string): Promise<ReleaseNotes | null> {
	try {
		const response = await requestUrl({
			url: `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`,
			method: "GET",
			headers: { Accept: "application/vnd.github+json" },
			throw: false,
		});
		if (response.status !== 200) return null;
		return parseRelease(JSON.parse(response.text));
	} catch {
		return null;
	}
}

function parseRelease(data: unknown): ReleaseNotes | null {
	if (!data || typeof data !== "object") return null;
	const r = data as Record<string, unknown>;
	const tag = typeof r.tag_name === "string" ? r.tag_name : "";
	const name = typeof r.name === "string" && r.name.trim() ? r.name : tag;
	const body = typeof r.body === "string" ? r.body.trim() : "";
	const htmlUrl = typeof r.html_url === "string" ? r.html_url : "";
	if (!tag) return null;
	return { tag, name, body, htmlUrl };
}

/** Strip common GitHub markdown noise for a readable modal preview. */
export function formatReleaseBody(body: string): string {
	if (!body.trim()) return "No release notes were published for this version.";
	return body
		.replace(/\r\n/g, "\n")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/__(.+?)__/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/^\s*[-*+]\s+/gm, "• ")
		.trim();
}
