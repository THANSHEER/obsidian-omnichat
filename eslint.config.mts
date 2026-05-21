import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

// All DEFAULT_BRANDS from eslint-plugin-obsidianmd, extended with this plugin's AI services.
// Keep in sync when updating eslint-plugin-obsidianmd.
const SENTENCE_CASE_BRANDS = [
	// Operating systems
	"iOS", "iPadOS", "macOS", "Windows", "Android", "Linux",
	// Obsidian
	"Obsidian", "Obsidian Sync", "Obsidian Publish",
	// Cloud storage
	"Google Drive", "Dropbox", "OneDrive", "iCloud Drive",
	// Communication
	"YouTube", "Slack", "Discord", "Telegram", "WhatsApp", "Twitter", "X",
	// Productivity
	"Readwise", "Zotero", "Excalidraw", "Mermaid",
	// Languages
	"Markdown", "LaTeX", "JavaScript", "TypeScript", "Node.js",
	// Dev tools
	"npm", "pnpm", "Yarn", "Git", "GitHub", "GitLab",
	// Other
	"Notion", "Evernote", "Roam Research", "Logseq", "Anki", "Reddit",
	"VS Code", "Visual Studio Code", "IntelliJ IDEA", "WebStorm", "PyCharm",
	// AI services used by this plugin
	"ChatGPT", "Claude", "DeepSeek", "Perplexity", "Gemini", "Grok",
	"Google", "xAI", "ChatPortal",
];

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Override sentence-case rule to include this plugin's AI service brand names.
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case": ["error", {
				enforceCamelCaseLower: true,
				brands: SENTENCE_CASE_BRANDS,
			}],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"package.json",
		// Test infrastructure — not part of the plugin source
		"__mocks__/**",
		"src/__tests__/**",
		"vitest.config.ts",
	]),
);
