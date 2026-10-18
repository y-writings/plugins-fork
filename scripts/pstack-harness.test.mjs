import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM_GENERATOR = "scripts/generate-pstack-harness-trees.mjs";
const GENERATOR = "scripts/generate-pstack-codex.mjs";
const VALIDATOR = "scripts/validate-codex-plugins.mjs";
const OUT = "harness/codex/pstack";
const PLUGIN = { $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", name: "pstack", version: "1.2.3", description: "Fixture workflows" };
const CODEX_PLUGIN = { name: "pstack", version: "1.2.3", description: "Fixture workflows", skills: "./skills/" };
const MANUAL = "---\nname: poteto-mode\ndescription: Manual workflow\ndisable-model-invocation: true\n---\n\n# Mode\n\nUse `Task`.\n";
const AUTOMATIC = "---\nname: setup-pstack\ndescription: Configure pstack\n---\n\n# Setup\n\nConfigure models.\n";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pstack-harness-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const script of [UPSTREAM_GENERATOR, GENERATOR, VALIDATOR]) write(script, readFileSync(join(ROOT, script)));
  write("pstack/plugin.json", JSON.stringify(PLUGIN));
  write("pstack/LICENSE", "Fixture license\n");
  write("pstack/README.md", "[guide](./docs/guide/README.md)\n[Claude](./docs/harness/claude-code.md)\n[automation](./automations/benny/README.md)\n");
  write("pstack/docs/guide/README.md", "[image](./image.bin)\n");
  write("pstack/docs/guide/image.bin", Buffer.from([0, 255, 1]));
  write("pstack/docs/harness/claude-code.md", "# Claude Code\n\n`Task` maps to Agent.\n");
  write("pstack/docs/harness/codex.md", "# Codex\n\n`Task` maps to spawn_agent.\n");
  write("pstack/agents/poteto-agent.md", "# Delegate\n\nRead poteto-mode.\n");
  write("pstack/automations/benny/README.md", "# Cursor automation\n");
  write("pstack/skills/poteto-mode/SKILL.md", MANUAL);
  write("pstack/skills/poteto-mode/scripts/run.sh", "#!/bin/sh\nexit 0\n");
  chmodSync(join(root, "pstack/skills/poteto-mode/scripts/run.sh"), 0o755);
  write("pstack/skills/setup-pstack/SKILL.md", AUTOMATIC);
  const run = (script, ...args) => {
    const result = spawnSync(process.execPath, [join(root, script), ...args], { encoding: "utf8" });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const read = (path) => readFileSync(join(root, path), "utf8");
  const snapshot = (path) => readdirSync(join(root, path)).sort().map((name) => {
    const child = join(path, name);
    const stat = statSync(join(root, child));
    return stat.isDirectory()
      ? [name, snapshot(child)]
      : [name, readFileSync(join(root, child)), stat.mode & 0o111];
  });
  return { root, write, run, read, snapshot };
}

test("Codex bundles its adapter, resources, and matching manifests", (t) => {
  const f = fixture(t);
  const result = f.run(GENERATOR);
  assert.equal(result.status, 0, result.output);
  assert.match(f.read(`${OUT}/skills/poteto-mode/SKILL.md`), /\.\.\/\.\.\/docs\/harness\/codex\.md/);
  assert.equal(f.read(`${OUT}/docs/harness/codex.md`), f.read("pstack/docs/harness/codex.md"));
  assert.equal(f.read(`${OUT}/skills/setup-pstack/SKILL.md`), AUTOMATIC);
  assert.deepEqual(readFileSync(join(f.root, OUT, "docs/guide/image.bin")), Buffer.from([0, 255, 1]));
  assert.ok(statSync(join(f.root, OUT, "skills/poteto-mode/scripts/run.sh")).mode & 0o111);
  assert.equal(f.read(`${OUT}/agents/poteto-agent.md`), f.read("pstack/agents/poteto-agent.md"));
  assert.match(f.read(`${OUT}/README.md`), /\[guide\]\(\.\/docs\/guide\/README\.md\)/);
  assert.match(f.read(`${OUT}/README.md`), /\[Claude\]\(https:\/\/github.com\/cursor\/plugins\/blob\/main\/pstack\/docs\/harness\/claude-code\.md\)/);
  assert.match(f.read(`${OUT}/README.md`), /https:\/\/github.com\/cursor\/plugins\/blob\/main\/pstack\/automations\/benny\/README.md/);
  assert.deepEqual(JSON.parse(f.read(`${OUT}/plugin.json`)), PLUGIN);
  assert.deepEqual(JSON.parse(f.read(`${OUT}/.codex-plugin/plugin.json`)), CODEX_PLUGIN);
  assert.ok(!existsSync(join(f.root, OUT, "docs/harness/claude-code.md")));
  assert.ok(!existsSync(join(f.root, OUT, ".claude-plugin")));
  assert.equal(f.read("pstack/skills/poteto-mode/SKILL.md"), MANUAL);
  const check = f.run(GENERATOR, "--check");
  assert.equal(check.status, 0, check.output);
});

test("Codex preserves manual-only policy without disabling automatic setup", (t) => {
  const f = fixture(t);
  assert.equal(f.run(GENERATOR).status, 0);
  const sidecar = `${OUT}/skills/poteto-mode/agents/openai.yaml`;
  assert.equal(f.read(sidecar), "policy:\n  allow_implicit_invocation: false\n");
  assert.ok(!existsSync(join(f.root, OUT, "skills/setup-pstack/agents/openai.yaml")));
  rmSync(join(f.root, sidecar));
  const check = f.run(GENERATOR, "--check");
  assert.equal(check.status, 1);
  assert.ok(check.output.includes(sidecar), check.output);
});

test("a missing Codex tool mapping fails before replacing the generated tree", (t) => {
  const f = fixture(t);
  assert.equal(f.run(GENERATOR).status, 0);
  const before = f.snapshot(OUT);
  f.write("pstack/docs/harness/codex.md", "# Incomplete adapter\n");
  const result = f.run(GENERATOR);
  assert.equal(result.status, 1);
  assert.match(result.output, /Codex adapter has no row for `Task`/);
  assert.deepEqual(f.snapshot(OUT), before);
});

test("regeneration replaces only the owned output and leaves both harnesses independently checkable", (t) => {
  const f = fixture(t);
  const source = f.snapshot("pstack");
  assert.equal(f.run(UPSTREAM_GENERATOR).status, 0);
  const upstream = f.snapshot("harness/pstack");
  f.write("harness/codex/other-plugin/keep.txt", "Keep sibling plugin.\n");
  assert.equal(f.run(GENERATOR).status, 0);
  assert.deepEqual(f.snapshot("harness/pstack"), upstream, "Codex generation changed upstream output");
  const codex = f.snapshot(OUT);
  const stale = `${OUT}/obsolete.txt`;
  f.write(stale, "Stale generated file.\n");
  const drifted = f.snapshot(OUT);
  const check = f.run(GENERATOR, "--check");
  assert.equal(check.status, 1);
  assert.ok(check.output.includes(stale), check.output);
  assert.deepEqual(f.snapshot(OUT), drifted, "--check changed generated files");
  assert.equal(f.run(GENERATOR).status, 0);
  assert.deepEqual(f.snapshot(OUT), codex, "regeneration did not remove stale output");
  assert.deepEqual(f.snapshot("harness/pstack"), upstream);
  assert.equal(f.read("harness/codex/other-plugin/keep.txt"), "Keep sibling plugin.\n");
  assert.equal(f.run(UPSTREAM_GENERATOR).status, 0);
  assert.deepEqual(f.snapshot(OUT), codex, "upstream generation changed Codex output");
  assert.deepEqual(f.snapshot("pstack"), source, "generation changed source files");
  for (const script of [UPSTREAM_GENERATOR, GENERATOR]) {
    const result = f.run(script, "--check");
    assert.equal(result.status, 0, result.output);
  }
});

test("Codex marketplace validation accepts portable packages and checks identity and version", (t) => {
  const f = fixture(t);
  const marketplace = {
    name: "fixture",
    plugins: [{
      name: "pstack",
      source: { source: "local", path: `./${OUT}` },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    }],
  };
  f.write(".agents/plugins/marketplace.json", JSON.stringify(marketplace));
  assert.equal(f.run(GENERATOR).status, 0);
  const valid = f.run(VALIDATOR);
  assert.equal(valid.status, 0, valid.output);
  const manifest = `${OUT}/.codex-plugin/plugin.json`;
  const portableManifest = `${OUT}/plugin.json`;
  rmSync(join(f.root, manifest));
  const portable = f.run(VALIDATOR);
  assert.equal(portable.status, 0, portable.output);
  for (const [value, diagnostic] of [
    [null, /missing plugin.json or \.codex-plugin\/plugin.json/],
    [{ ...CODEX_PLUGIN, name: "wrong" }, /Codex marketplace name does not match/],
    [{ ...CODEX_PLUGIN, version: "2.0.0" }, /manifest versions differ/],
  ]) {
    if (value === null) rmSync(join(f.root, portableManifest));
    else f.write(manifest, JSON.stringify(value));
    const result = f.run(VALIDATOR);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, diagnostic);
    f.write(portableManifest, JSON.stringify(PLUGIN));
  }
  f.write(manifest, JSON.stringify(CODEX_PLUGIN));
  for (const path of [OUT, "./../outside"]) {
    marketplace.plugins[0].source.path = path;
    f.write(".agents/plugins/marketplace.json", JSON.stringify(marketplace));
    const result = f.run(VALIDATOR);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Codex source path must start with \.\/ and stay inside the repository/);
  }
});
