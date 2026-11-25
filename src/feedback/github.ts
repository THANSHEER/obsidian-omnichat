import { requestUrl } from "obsidian";
import { GITHUB_REPO } from "./constants";

export interface GitHubReleaseAsset {
	name: string;
	browser_download_url: string;
	size: number;
	download_count: number;
}

export interface GitHubRelease {
	tag_name: string;
	name: string;
	published_at: string;
	html_url: string;
	body: string;
	prerelease: boolean;
	draft: boolean;
	assets: GitHubReleaseAsset[];
}

export interface ReleaseNotes {
	tag: string;
	name: string;
	body: string;
	htmlUrl: string;
	publishedAt?: string;
	assets?: GitHubReleaseAsset[];
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

export async function fetchReleaseByTag(tag: string): Promise<ReleaseNotes | null> {
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

/** Fetch recent releases from GitHub repository to allow browsing and downloading older versions. */
export async function fetchAllReleases(limit = 15): Promise<GitHubRelease[]> {
	try {
		const response = await requestUrl({
			url: `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=${limit}`,
			method: "GET",
			headers: { Accept: "application/vnd.github+json" },
			throw: false,
		});
		if (response.status !== 200) return [];
		const list: unknown = JSON.parse(response.text);
		if (!Array.isArray(list)) return [];
		return list
			.map(parseGitHubRelease)
			.filter((r): r is GitHubRelease => r !== null && !r.draft);
	} catch {
		return [];
	}
}

/** Fetch text content of a SHA-256 checksum asset file from GitHub. */
export async function fetchAssetChecksum(checksumUrl: string): Promise<string | null> {
	try {
		const response = await requestUrl({
			url: checksumUrl,
			method: "GET",
			throw: false,
		});
		if (response.status !== 200) return null;
		const trimmed = response.text.trim();
		const match = trimmed.match(/^([a-fA-F0-9]{64})/);
		return match?.[1] ?? trimmed;
	} catch {
		return null;
	}
}

export function parseGitHubRelease(data: unknown): GitHubRelease | null {
	if (!data || typeof data !== "object") return null;
	const r = data as Record<string, unknown>;
	const tag = typeof r.tag_name === "string" ? r.tag_name : "";
	if (!tag) return null;
	const name = typeof r.name === "string" && r.name.trim() ? r.name : tag;
	const body = typeof r.body === "string" ? r.body.trim() : "";
	const html_url = typeof r.html_url === "string" ? r.html_url : "";
	const published_at = typeof r.published_at === "string" ? r.published_at : "";
	const prerelease = Boolean(r.prerelease);
	const draft = Boolean(r.draft);

	const rawAssets = Array.isArray(r.assets) ? r.assets : [];
	const assets: GitHubReleaseAsset[] = rawAssets
		.map((a: unknown) => {
			if (!a || typeof a !== "object") return null;
			const item = a as Record<string, unknown>;
			const aName = typeof item.name === "string" ? item.name : "";
			const aUrl = typeof item.browser_download_url === "string" ? item.browser_download_url : "";
			if (!aName || !aUrl) return null;
			return {
				name: aName,
				browser_download_url: aUrl,
				size: typeof item.size === "number" ? item.size : 0,
				download_count: typeof item.download_count === "number" ? item.download_count : 0,
			};
		})
		.filter((a): a is GitHubReleaseAsset => a !== null);

	return {
		tag_name: tag,
		name,
		published_at,
		html_url,
		body,
		prerelease,
		draft,
		assets,
	};
}

export function parseRelease(data: unknown): ReleaseNotes | null {
	const rel = parseGitHubRelease(data);
	if (!rel) return null;
	return {
		tag: rel.tag_name,
		name: rel.name,
		body: rel.body,
		htmlUrl: rel.html_url,
		publishedAt: rel.published_at,
		assets: rel.assets,
	};
}

/** Locate the primary .zip distribution asset in release assets. */
export function findZipAsset(assets?: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
	if (!assets || !Array.isArray(assets)) return null;
	return assets.find(a => a.name.toLowerCase().endsWith(".zip")) ?? null;
}

/** Locate the .sha256 checksum asset corresponding to a zip release. */
export function findChecksumAsset(assets?: GitHubReleaseAsset[], zipName?: string): GitHubReleaseAsset | null {
	if (!assets || !Array.isArray(assets)) return null;
	if (zipName) {
		const exact = assets.find(a => a.name === `${zipName}.sha256`);
		if (exact) return exact;
	}
	return assets.find(a => a.name.toLowerCase().endsWith(".sha256")) ?? null;
}

/** Format byte size to human readable string (e.g., "128.5 KB"). */
export function formatFileSize(bytes: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
