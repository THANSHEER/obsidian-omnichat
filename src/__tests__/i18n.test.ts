import { describe, expect, it } from "vitest";
import { getActiveLocale, LOCALES, normalizeLocale, setLocale, SUPPORTED_LOCALES, t } from "../i18n";
import { en } from "../i18n/locales/en";
import { zhCN } from "../i18n/locales/zh-CN";

describe("i18n localization", () => {
	it("normalizes common locale variants to registered locales", () => {
		expect(normalizeLocale("en")).toBe("en");
		expect(normalizeLocale("en-US")).toBe("en");
		expect(normalizeLocale("zh")).toBe("zh-CN");
		expect(normalizeLocale("zh-cn")).toBe("zh-CN");
		expect(normalizeLocale("zh_CN")).toBe("zh-CN");
		expect(normalizeLocale("zh-Hans")).toBe("zh-CN");
		expect(normalizeLocale("fr-FR")).toBe("en");
	});

	it("switches active locale and interpolates variables", () => {
		setLocale("zh-CN");
		expect(getActiveLocale()).toBe("zh-CN");
		expect(t("view.mode.browser")).toBe("网页");
		expect(t("view.loading", { service: "Claude" })).toBe("正在加载 Claude…");

		setLocale("en");
		expect(getActiveLocale()).toBe("en");
		expect(t("view.mode.browser")).toBe("Web");
		expect(t("view.loading", { service: "Claude" })).toBe("Loading Claude…");
	});

	it("registers every supported locale and keeps zh-CN keys valid", () => {
		for (const loc of SUPPORTED_LOCALES) {
			expect(LOCALES[loc.code]).toBeDefined();
		}
		const enKeys = new Set(Object.keys(en));
		for (const key of Object.keys(zhCN)) {
			expect(enKeys.has(key)).toBe(true);
		}
	});
});
