import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		reporters: ["verbose"],
	},
	resolve: {
		alias: {
			obsidian: resolve(__dirname, "__mocks__/obsidian.ts"),
		},
	},
});
