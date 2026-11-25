import { describe, it, expect } from "vitest";
import {
	formatReleaseBody,
	parseGitHubRelease,
	findZipAsset,
	findChecksumAsset,
	formatFileSize,
	type GitHubReleaseAsset,
} from "../feedback/github";
import { PRODUCT_SLUG, productFormSiteUrl } from "../feedback/constants";

describe("feedback constants", () => {
	it("uses the omnichat product slug", () => {
		expect(PRODUCT_SLUG).toBe("omnichat");
	});

	it("builds hosted form URLs on the website, not the API", () => {
		expect(productFormSiteUrl("feedback")).toBe("https://geekstash.dev/omnichat/feedback");
		expect(productFormSiteUrl("feature-request")).toBe(
			"https://geekstash.dev/omnichat/feature-request",
		);
		expect(productFormSiteUrl("uninstall")).toBe("https://geekstash.dev/omnichat/uninstall");
		expect(productFormSiteUrl("bug-report")).toBe("https://geekstash.dev/omnichat/bug-report");
	});

	it("appends an optional topic to the feedback URL", () => {
		expect(productFormSiteUrl("feedback", { topic: "post-update" })).toBe(
			"https://geekstash.dev/omnichat/feedback?topic=post-update",
		);
	});
});

describe("formatReleaseBody", () => {
	it("returns a fallback when body is empty", () => {
		expect(formatReleaseBody("")).toContain("No release notes");
	});

	it("strips markdown headings and bold markers", () => {
		const out = formatReleaseBody("## What's new\n\n**Fixed** the bug\n- Item one");
		expect(out).not.toMatch(/^#/m);
		expect(out).toContain("Fixed the bug");
		expect(out).toContain("• Item one");
	});
});

describe("GitHubRelease parsing and asset utilities", () => {
	const mockAssets: GitHubReleaseAsset[] = [
		{
			name: "main.js",
			browser_download_url: "https://github.com/org/repo/releases/download/v1.7.5/main.js",
			size: 130000,
			download_count: 50,
		},
		{
			name: "manifest.json",
			browser_download_url: "https://github.com/org/repo/releases/download/v1.7.5/manifest.json",
			size: 500,
			download_count: 50,
		},
		{
			name: "styles.css",
			browser_download_url: "https://github.com/org/repo/releases/download/v1.7.5/styles.css",
			size: 48000,
			download_count: 50,
		},
		{
			name: "aibrowser-chat-1.7.5.zip",
			browser_download_url: "https://github.com/org/repo/releases/download/v1.7.5/aibrowser-chat-1.7.5.zip",
			size: 65000,
			download_count: 120,
		},
		{
			name: "aibrowser-chat-1.7.5.zip.sha256",
			browser_download_url: "https://github.com/org/repo/releases/download/v1.7.5/aibrowser-chat-1.7.5.zip.sha256",
			size: 96,
			download_count: 15,
		},
	];

	it("parseGitHubRelease extracts release data and typed assets", () => {
		const raw = {
			tag_name: "v1.7.5",
			name: "v1.7.5 - Agent GUI & Dual Mode",
			published_at: "2026-09-27T10:00:00Z",
			html_url: "https://github.com/org/repo/releases/tag/v1.7.5",
			body: "Release notes body",
			prerelease: false,
			draft: false,
			assets: mockAssets,
		};

		const parsed = parseGitHubRelease(raw);
		expect(parsed).not.toBeNull();
		expect(parsed?.tag_name).toBe("v1.7.5");
		expect(parsed?.name).toBe("v1.7.5 - Agent GUI & Dual Mode");
		expect(parsed?.assets).toHaveLength(5);
		expect(parsed?.assets[3].name).toBe("aibrowser-chat-1.7.5.zip");
	});

	it("parseGitHubRelease returns null for invalid input", () => {
		expect(parseGitHubRelease(null)).toBeNull();
		expect(parseGitHubRelease({})).toBeNull();
		expect(parseGitHubRelease({ tag_name: "" })).toBeNull();
	});

	it("findZipAsset correctly identifies zip archive asset", () => {
		const zip = findZipAsset(mockAssets);
		expect(zip).not.toBeNull();
		expect(zip?.name).toBe("aibrowser-chat-1.7.5.zip");
	});

	it("findChecksumAsset locates corresponding sha256 checksum asset", () => {
		const sha = findChecksumAsset(mockAssets, "aibrowser-chat-1.7.5.zip");
		expect(sha).not.toBeNull();
		expect(sha?.name).toBe("aibrowser-chat-1.7.5.zip.sha256");
	});

	it("formatFileSize formats bytes to KB and MB correctly", () => {
		expect(formatFileSize(0)).toBe("0 B");
		expect(formatFileSize(500)).toBe("500 B");
		expect(formatFileSize(1024)).toBe("1.0 KB");
		expect(formatFileSize(65000)).toBe("63.5 KB");
		expect(formatFileSize(1048576 * 2)).toBe("2.0 MB");
	});
});
