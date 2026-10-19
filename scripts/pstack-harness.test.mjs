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
  assert.doesNotMatch(f.read(`${OUT}/skills/poteto-mode/SKILL.md`), /^disable-model-invocation:/m);
  assert.ok(!existsSync(join(f.root, OUT, "skills/setup-pstack/agents/openai.yaml")));
  rmSync(join(f.root, sidecar));
  const check = f.run(GENERATOR, "--check");
  assert.equal(check.status, 1);
  assert.ok(check.output.includes(sidecar), check.output);
});

test("Codex keeps large entrypoints compact without losing instructions or relative resources", (t) => {
  const f = fixture(t);
  const body = "    Keep this indented code block.\n\n# Mode\n\n" + "Keep every instruction.\n".repeat(1000)
    + "\n[Details](references/details.md)\n";
  const source = MANUAL.slice(0, MANUAL.indexOf("# Mode")) + body;
  f.write("pstack/skills/poteto-mode/SKILL.md", source);
  f.write("pstack/skills/poteto-mode/references/details.md", "Workflow details.\n");
  const result = f.run(GENERATOR);
  assert.equal(result.status, 0, result.output);
  const entry = f.read(`${OUT}/skills/poteto-mode/SKILL.md`);
  assert.ok(Buffer.byteLength(entry) <= 8000, "the entrypoint must fit Codex's main prompt byte limit");
  const href = entry.match(/\]\(([^)]+codex-instructions\.md)\)/)?.[1];
  assert.ok(href, "the entrypoint must link to the complete workflow");
  const workflow = join(`${OUT}/skills/poteto-mode`, href);
  assert.equal(dirname(workflow), `${OUT}/skills/poteto-mode`, "workflow-relative paths must keep their original base");
  assert.equal(f.read(workflow), body, "the complete source instructions must survive generation");
  assert.equal(f.read(join(dirname(workflow), "references/details.md")), "Workflow details.\n");
  assert.equal(f.read("pstack/skills/poteto-mode/SKILL.md"), source);
});

test("Codex applies the byte limit to the final rendered skill", (t) => {
  const f = fixture(t);
  const linked = `${AUTOMATIC}\n[Automation](../../automations/benny/README.md)\n`;
  for (const [label, skill, source, split] of [
    ["at the limit", "setup-pstack", AUTOMATIC + "x".repeat(8000 - Buffer.byteLength(AUTOMATIC)), false],
    ["over the limit", "setup-pstack", AUTOMATIC + "x".repeat(8001 - Buffer.byteLength(AUTOMATIC)), true],
    ["UTF-8 bytes exceed character count", "setup-pstack", AUTOMATIC + "あ".repeat(3000), true],
    ["adapter pushes the entrypoint over the limit", "poteto-mode", MANUAL + "x".repeat(8000 - Buffer.byteLength(MANUAL)), true],
    ["rewritten links push the entrypoint over the limit", "setup-pstack", linked + "x".repeat(8000 - Buffer.byteLength(linked)), true],
  ]) {
    f.write(`pstack/skills/${skill}/SKILL.md`, source);
    const result = f.run(GENERATOR);
    assert.equal(result.status, 0, `${label}: ${result.output}`);
    const entry = f.read(`${OUT}/skills/${skill}/SKILL.md`);
    assert.ok(Buffer.byteLength(entry) <= 8000, label);
    assert.equal(existsSync(join(f.root, OUT, "skills", skill, "codex-instructions.md")), split, label);
    if (!split) assert.equal(entry, source, "small skills must retain their inline instructions");
    if (skill === "poteto-mode") {
      assert.match(f.read(`${OUT}/skills/${skill}/codex-instructions.md`), /\[the Codex adapter\]\(\.\.\/\.\.\/docs\/harness\/codex\.md\)/);
    }
  }
  assert.match(f.read(`${OUT}/skills/setup-pstack/codex-instructions.md`), /\[Automation\]\(https:\/\/github.com\/cursor\/plugins\/blob\/main\/pstack\/automations\/benny\/README\.md\)/);
});

test("Codex rejects instruction-file collisions before replacing the generated tree", (t) => {
  for (const resource of ["codex-instructions.md", "codex-instructions.md/notes.txt"]) {
    const f = fixture(t);
    f.write(`pstack/skills/poteto-mode/${resource}`, "Existing source instructions.\n");
    assert.equal(f.run(GENERATOR).status, 0);
    const before = f.snapshot(OUT);
    f.write("pstack/skills/poteto-mode/SKILL.md", MANUAL + "x".repeat(8000));
    const result = f.run(GENERATOR);
    assert.equal(result.status, 1, `${resource}: ${result.output}`);
    assert.match(result.output, /Cannot generate skills\/poteto-mode\/codex-instructions\.md: a source resource already exists/);
    assert.deepEqual(f.snapshot(OUT), before, resource);
  }
});

test("Codex rejects an oversized entrypoint when its metadata cannot be moved", (t) => {
  const f = fixture(t);
  assert.equal(f.run(GENERATOR).status, 0);
  const before = f.snapshot(OUT);
  f.write("pstack/skills/poteto-mode/SKILL.md", MANUAL.replace("Manual workflow", "x".repeat(8000)));
  const result = f.run(GENERATOR);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/poteto-mode\/SKILL\.md still exceeds 8000 bytes/);
  assert.deepEqual(f.snapshot(OUT), before);
});

test("Codex removes Cursor metadata while preserving portable fields and skill content", (t) => {
  const f = fixture(t);
  const portable = "name: poteto-mode\ndescription: >-\n  Preserve $& multiline\n  skill descriptions.\nlicense: MIT\ncompatibility: Requires Node.js\nallowed-tools: Read\nmetadata:\n  icon: keep-me\n  color: keep-me-too\n";
  const cursor = "disable-model-invocation: true\nicon: crown\ncolor: yellow\npaths:\n  - '**/*.ts'\n  - '**/*.tsx'\n";
  const body = "\n# Mode\n\npaths: keep this body text\n";
  const source = `---\n${portable}${cursor}---\n${body}`;
  f.write("pstack/skills/poteto-mode/SKILL.md", source);
  const generated = f.run(GENERATOR);
  assert.equal(generated.status, 0, generated.output);
  assert.equal(f.read(`${OUT}/skills/poteto-mode/SKILL.md`), `---\n${portable}---\n${body}`);
  assert.equal(f.read(`${OUT}/skills/poteto-mode/agents/openai.yaml`), "policy:\n  allow_implicit_invocation: false\n");
  assert.equal(f.read("pstack/skills/poteto-mode/SKILL.md"), source);
  const check = f.run(GENERATOR, "--check");
  assert.equal(check.status, 0, check.output);
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

for (const [key, path, instruction, mapping] of [
  ["`create-skill`", "SKILL.md", "Use the **create-skill** skill.", "`create-skill` maps to Codex's available skill-creator."],
  ["Bundled paths and scripts", "playbooks/run.md", "Run `scripts/run.sh`.", "Bundled paths and scripts resolve from the installed skill, keeping the project working directory."],
  ["Agent store", "playbooks/plan.md", "Write under the agent store's docs directory.", "Agent store uses a task-specific directory in the target workspace."],
  ["Plugin installation", "SKILL.md", "Install with `/add-plugin pstack`.", "Plugin installation uses the fork checkout's local Codex catalog."],
  ["Plugin installation", "playbooks/setup.md", "Install from Customize in the sidebar.", "Plugin installation uses the fork checkout's local Codex catalog."],
  ["`/visualize`", "playbooks/report.md", "Draw the numbers with `/visualize`.", "`/visualize` uses an available visualization tool or a static chart artifact."],
  ["External skills", "SKILL.md", "Run `/deslop` before commit.", "External skills use available session skills or the documented cleanup fallback."],
  ["External skills", "playbooks/verify.md", "Verify with `control-ui` or `control-cli`.", "External skills use available surface drivers and keep missing live proof incomplete."],
]) {
  test(`Codex requires the ${key} mapping for: ${instruction}`, (t) => {
    const f = fixture(t);
    assert.equal(f.run(GENERATOR).status, 0);
    const before = f.snapshot(OUT);
    f.write(`pstack/skills/setup-pstack/${path}`, path === "SKILL.md"
      ? `${AUTOMATIC}\n${instruction}\n`
      : instruction);
    const missing = f.run(GENERATOR);
    assert.equal(missing.status, 1, missing.output);
    assert.ok(missing.output.includes(`Codex adapter has no row for ${key}`), missing.output);
    assert.deepEqual(f.snapshot(OUT), before);
    f.write("pstack/docs/harness/codex.md", `${f.read("pstack/docs/harness/codex.md")}\n${mapping}\n`);
    const generated = f.run(GENERATOR);
    assert.equal(generated.status, 0, generated.output);
    assert.match(f.read(`${OUT}/skills/setup-pstack/SKILL.md`), /\.\.\/\.\.\/docs\/harness\/codex\.md/);
    const check = f.run(GENERATOR, "--check");
    assert.equal(check.status, 0, check.output);
  });
}

test("Codex routes known skills and principle aliases through the adapter", (t) => {
  const f = fixture(t);
  const adapter = f.read("pstack/docs/harness/codex.md");
  f.write("pstack/skills/principle-example/SKILL.md", AUTOMATIC.replace("name: setup-pstack", "name: principle-example"));
  for (const [instruction, needsAdapter] of [
    ["Read `poteto-mode`.", true],
    ["Read `/poteto-mode`.", true],
    ["Use the **poteto-mode** skill.", true],
    ["Apply the **example** principle skill.", true],
    ["Read [`poteto-mode`](../poteto-mode/SKILL.md).", false],
    ["Read [the **example** principle skill](../principle-example/SKILL.md).", false],
    ["Configure `setup-pstack`.", false],
    ["Read `missing-skill`.", false],
  ]) {
    f.write("pstack/skills/setup-pstack/SKILL.md", `${AUTOMATIC}\n${instruction}\n`);
    f.write("pstack/docs/harness/codex.md", adapter);
    const missing = f.run(GENERATOR);
    if (needsAdapter) {
      assert.equal(missing.status, 1, `${instruction}: ${missing.output}`);
      assert.match(missing.output, /Codex adapter has no row for Run another pstack skill/);
      f.write("pstack/docs/harness/codex.md", `${adapter}\nRun another pstack skill by its installed path.\n`);
    }
    const generated = needsAdapter ? f.run(GENERATOR) : missing;
    assert.equal(generated.status, 0, `${instruction}: ${generated.output}`);
    assert.equal(f.read(`${OUT}/skills/setup-pstack/SKILL.md`).includes("[the Codex adapter]"), needsAdapter, instruction);
  }
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

for (const [form, source] of [
  ["object", (path) => ({ source: "local", path })],
  ["string", (path) => path],
]) {
  test(`Codex marketplace validates paths, identity, and versions with ${form} sources`, (t) => {
    const f = fixture(t);
    const marketplace = {
      name: "fixture",
      plugins: [{
        name: "pstack",
        source: source(`./${OUT}`),
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
      marketplace.plugins[0].source = source(path);
      f.write(".agents/plugins/marketplace.json", JSON.stringify(marketplace));
      const result = f.run(VALIDATOR);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /Codex source path must start with \.\/ and stay inside the repository/);
    }
  });
}

test("Codex marketplace rejects malformed and nonlocal source objects", (t) => {
  const f = fixture(t);
  f.write(`${OUT}/plugin.json`, JSON.stringify(PLUGIN));
  for (const source of [null, { source: "local" }, { source: "local", path: 1 }, { source: "url", path: `./${OUT}` }]) {
    f.write(".agents/plugins/marketplace.json", JSON.stringify({
      plugins: [{ name: "pstack", source }],
    }));
    const result = f.run(VALIDATOR);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Codex marketplace entries must use a local source path/);
  }
});
