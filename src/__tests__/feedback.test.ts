import { describe, it, expect } from "vitest";
import { formatReleaseBody } from "../feedback/github";
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
