import { readFileSync, existsSync } from "fs";

let hasErrors = false;

function error(msg) {
	console.error(`❌ [ERROR] ${msg}`);
	hasErrors = true;
}

function warn(msg) {
	console.warn(`⚠️  [WARN] ${msg}`);
}

function success(msg) {
	console.log(`✅ [PASS] ${msg}`);
}

console.log("🔍 Running Obsidian Plugin Automated Verification Checks...\n");

// 1. Check manifest.json
if (!existsSync("manifest.json")) {
	error("manifest.json not found in repository root.");
} else {
	try {
		const manifestRaw = readFileSync("manifest.json", "utf8");
		const manifest = JSON.parse(manifestRaw);

		// ID validation
		if (!manifest.id || typeof manifest.id !== "string") {
			error("manifest.json must contain a valid 'id' string.");
		} else if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
			error(`Invalid 'id' "${manifest.id}". Plugin ID must contain only lowercase letters, numbers, hyphens, or underscores.`);
		} else if (manifest.id.toLowerCase().includes("obsidian")) {
			error(`Invalid 'id' "${manifest.id}". Plugin ID must not contain the word "obsidian".`);
		} else {
			success(`Plugin ID is valid: "${manifest.id}"`);
		}

		// Name validation
		if (!manifest.name || typeof manifest.name !== "string") {
			error("manifest.json must contain a valid 'name' string.");
		} else if (manifest.name.trim().length === 0) {
			error("Plugin 'name' cannot be empty.");
		} else {
			success(`Plugin Name is valid: "${manifest.name}"`);
		}

		// Version validation
		const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
		if (!manifest.version || !semverRegex.test(manifest.version)) {
			error(`Invalid 'version' "${manifest.version}". Must be a valid SemVer format (e.g. 1.0.0).`);
		} else {
			success(`Plugin Version format is valid: "${manifest.version}"`);
		}

		// minAppVersion validation
		if (!manifest.minAppVersion || !semverRegex.test(manifest.minAppVersion)) {
			error(`Invalid 'minAppVersion' "${manifest.minAppVersion}". Must be a valid SemVer format (e.g. 1.7.0).`);
		} else {
			success(`minAppVersion is valid: "${manifest.minAppVersion}"`);
		}

		// Description validation
		if (!manifest.description || typeof manifest.description !== "string") {
			error("manifest.json must contain a valid 'description' string.");
		} else {
			const desc = manifest.description.trim();
			if (!/[.!?]$/.test(desc)) {
				error("manifest.description MUST end with punctuation (. ! or ?).");
			} else if (desc.length > 250) {
				warn(`manifest.description is quite long (${desc.length} chars). Keep under 250 characters if possible.`);
			} else {
				success("manifest.description is properly formatted with terminating punctuation.");
			}
		}

		// Author validation
		if (!manifest.author || typeof manifest.author !== "string") {
			error("manifest.json must contain a valid 'author' string.");
		} else {
			success(`Author is valid: "${manifest.author}"`);
		}

		// Author URL validation
		if (manifest.authorUrl) {
			if (!manifest.authorUrl.startsWith("http://") && !manifest.authorUrl.startsWith("https://")) {
				error(`'authorUrl' must start with http:// or https:// (found: "${manifest.authorUrl}")`);
			} else {
				success(`Author URL is valid: "${manifest.authorUrl}"`);
			}
		}

		// Funding URL validation
		if (manifest.fundingUrl) {
			if (typeof manifest.fundingUrl === "string") {
				if (!manifest.fundingUrl.startsWith("http://") && !manifest.fundingUrl.startsWith("https://")) {
					error(`'fundingUrl' must start with http:// or https:// (found: "${manifest.fundingUrl}")`);
				} else {
					success(`Funding URL is valid: "${manifest.fundingUrl}"`);
				}
			} else if (typeof manifest.fundingUrl === "object") {
				for (const [platform, url] of Object.entries(manifest.fundingUrl)) {
					if (typeof url !== "string" || (!url.startsWith("http://") && !url.startsWith("https://"))) {
						error(`Invalid fundingUrl for "${platform}": "${url}"`);
					}
				}
				success(`Funding URLs object is valid.`);
			}
		}

		// Compare with package.json
		if (existsSync("package.json")) {
			const pkg = JSON.parse(readFileSync("package.json", "utf8"));
			if (pkg.version !== manifest.version) {
				error(`Version mismatch: package.json version (${pkg.version}) does not match manifest.json (${manifest.version}).`);
			} else {
				success(`Version synchronized with package.json (${manifest.version})`);
			}
		}

		// Compare with versions.json
		if (existsSync("versions.json")) {
			const versions = JSON.parse(readFileSync("versions.json", "utf8"));
			if (!versions[manifest.version]) {
				error(`versions.json is missing an entry for version "${manifest.version}". Run version bump to update it.`);
			} else if (versions[manifest.version] !== manifest.minAppVersion) {
				error(`versions.json entry for "${manifest.version}" (${versions[manifest.version]}) does not match manifest.minAppVersion (${manifest.minAppVersion}).`);
			} else {
				success(`versions.json is properly mapped for version "${manifest.version}" -> minAppVersion "${manifest.minAppVersion}"`);
			}
		}

	} catch (err) {
		error(`Failed to parse manifest.json: ${err.message}`);
	}
}

// 2. Check Build Artifacts
console.log("\n📦 Checking Build Artifacts for Release Compliance...");

const requiredArtifacts = ["main.js", "manifest.json"];
if (existsSync("styles.css")) {
	requiredArtifacts.push("styles.css");
}

for (const file of requiredArtifacts) {
	if (!existsSync(file)) {
		error(`Required release artifact "${file}" does not exist in root directory.`);
	} else {
		const content = readFileSync(file, "utf8");
		if (content.trim().length === 0) {
			error(`Release artifact "${file}" is empty (0 bytes).`);
		} else {
			success(`Artifact "${file}" is present (${(content.length / 1024).toFixed(1)} KB).`);
		}
	}
}

console.log("\n" + "=".repeat(60));
if (hasErrors) {
	console.error("❌ Obsidian validation failed! Please fix the errors above before publishing.");
	process.exit(1);
} else {
	console.log("🎉 All automated Obsidian checks passed successfully! Ready for release.");
	process.exit(0);
}
