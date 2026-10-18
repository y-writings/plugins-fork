#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loadJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
const marketplace = loadJSON(resolve(root, ".agents/plugins/marketplace.json"));
let errors = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  errors++;
}

for (const entry of marketplace.plugins ?? []) {
  if (entry.source?.source !== "local" || typeof entry.source.path !== "string") {
    fail(`Plugin "${entry.name}": Codex marketplace entries must use a local source path`);
    continue;
  }
  const pluginDir = resolve(root, entry.source.path);
  if (!entry.source.path.startsWith("./") || !pluginDir.startsWith(`${root}${sep}`)) {
    fail(`Plugin "${entry.name}": Codex source path must start with ./ and stay inside the repository`);
    continue;
  }
  const manifests = ["plugin.json", ".codex-plugin/plugin.json"]
    .filter((path) => existsSync(resolve(pluginDir, path)))
    .map((path) => ({ path, plugin: loadJSON(resolve(pluginDir, path)) }));
  if (manifests.length === 0) {
    fail(`Plugin "${entry.name}": missing plugin.json or .codex-plugin/plugin.json in "${entry.source.path}"`);
    continue;
  }
  for (const { path, plugin } of manifests) {
    if (plugin.name !== entry.name) {
      fail(`Plugin "${entry.name}": Codex marketplace name does not match ${path} name "${plugin.name}"`);
    }
  }
  const versions = manifests
    .map(({ path, plugin }) => ({ path, version: plugin.version }))
    .filter(({ version }) => version !== undefined);
  if (new Set(versions.map(({ version }) => version)).size > 1) {
    fail(`Plugin "${entry.name}": manifest versions differ:`);
    for (const { path, version } of versions) console.error(`  ${entry.source.path}/${path}: ${version}`);
  }
}

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log("All Codex plugins validated successfully.");
