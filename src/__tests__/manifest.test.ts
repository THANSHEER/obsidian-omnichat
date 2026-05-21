import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../");

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf-8"));
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg      = JSON.parse(readFileSync(resolve(root, "package.json"),  "utf-8"));

describe("manifest.json — required fields", () => {
	it("has a non-empty id", () => {
		expect(typeof manifest.id).toBe("string");
		expect((manifest.id as string).length).toBeGreaterThan(0);
	});

	it("id is lowercase alphanumeric with optional hyphens", () => {
		expect(manifest.id).toMatch(/^[a-z0-9-]+$/);
	});

	it("has a non-empty name", () => {
		expect(typeof manifest.name).toBe("string");
		expect((manifest.name as string).length).toBeGreaterThan(0);
	});

	it("has a non-empty description", () => {
		expect(typeof manifest.description).toBe("string");
		expect((manifest.description as string).length).toBeGreaterThan(0);
	});

	it("has a non-empty author", () => {
		expect(typeof manifest.author).toBe("string");
		expect((manifest.author as string).length).toBeGreaterThan(0);
	});
});

describe("manifest.json — versioning", () => {
	it("version follows semantic versioning (x.y.z)", () => {
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("version matches package.json version", () => {
		expect(manifest.version).toBe(pkg.version);
	});

	it("minAppVersion follows semantic versioning", () => {
		expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

describe("manifest.json — plugin metadata", () => {
	it("isDesktopOnly is true (plugin requires Electron webview)", () => {
		expect(manifest.isDesktopOnly).toBe(true);
	});
});
