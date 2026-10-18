# pstack in Codex

pstack skills use Cursor names. In Codex, read this file once per session before following a workflow, then apply the mappings below to its skills, playbooks, and agent briefs. `<pstack>` is the installed folder containing `skills/` and `docs/`; resolve it from the skill you opened, not the current working directory. Read the model rule described below when you load this adapter. Use only tools, fields, and values offered by the current session. If a Cursor field has no mapping, omit it and explain the limitation once.

## Tools

| Cursor | Codex |
| --- | --- |
| `Task` | The session's `spawn_agent` tool, which may be under `collaboration`. Give every worker the absolute path to this adapter and require it to read the adapter before its task instructions, including when the brief uses a reference template verbatim. Collect its result with the available wait tool and agent messages. If delegation is unavailable, do the work sequentially and disclose the missing independent review. |
| `AskQuestion` | `request_user_input` when available in the current mode, or `request_user_input_async` when offered. Otherwise ask in plain text. Never call a Plan-only tool outside Plan mode. |
| Open a todolist | Use `update_plan` if offered. Otherwise keep a short checklist in your replies and update it at each phase. |
| Run another pstack skill (`/name`, `name`, or "the **name** skill") | Read `<pstack>/skills/<name>/SKILL.md` and follow it. A shortened `**name** principle skill` reference means `<pstack>/skills/principle-<name>/SKILL.md`. Direct relative skill links already give the path. When giving the user a prompt, write `$pstack:<name>`, for example `$pstack:poteto-mode`, matching the installed plugin's skill picker. The shared guide's slash commands mean the same skills. |
| `create-skill`, `/create-skill` | Use Codex's `skill-creator`: find it in the current session's available-skills catalog, read the listed `SKILL.md`, and follow its supported authoring and validation steps. User-facing invocation is `$skill-creator`. If unavailable, report the missing dependency and leave dependent authoring incomplete. Do not claim a Cursor-specific test or description-optimization loop ran unless the available creator supports it. |
| `Read`, `Grep`, `Glob`, `Bash` | Use the session's file and shell tools; prefer `rg` and `rg --files` for searches. |

## Bundled paths and scripts

Resolve `pstack/<path>` from the installed `<pstack>/<path>`, including when a playbook asks for `git show origin/main:pstack/<path>`: read the installed file directly, since the target project's Git history does not contain the plugin. A bare `scripts/<path>` belonging to a pstack skill resolves under `<pstack>/skills/<owning-skill>/scripts/<path>`. Project-owned paths, such as a project's `scripts/snapshot.sh`, keep their project meaning.

Substitute the resolved absolute plugin path for `<pstack>` and quote it. Keep the working directory at the target project and preserve all remaining flags and arguments, including relative plan, log, repository, and store paths. Do not change into the plugin cache to run a workflow helper.

| Shared command | Installed command prefix |
| --- | --- |
| `node pstack/skills/poteto-mode/scripts/check-plan.mjs` | `node "<pstack>/skills/poteto-mode/scripts/check-plan.mjs"` |
| `scripts/watch-pr/watch-pr` | `"<pstack>/skills/poteto-mode/scripts/watch-pr/watch-pr"` |
| `bun scripts/orch/orch.ts`, the `orch` shorthand | `bun "<pstack>/skills/poteto-mode/scripts/orch/orch.ts"` |
| `scripts/worktree-audit.sh` | `"<pstack>/skills/poteto-mode/scripts/worktree-audit.sh"` |
| `scripts/log.sh` | `"<pstack>/skills/show-me-your-work/scripts/log.sh"` |

The watcher and orchestration CLI bootstrap their own dependencies. For their package's maintainer checks only, use `bun --cwd "<pstack>/skills/poteto-mode/scripts" run test` or `run typecheck`, since those package scripts use package-relative paths. Report a missing runtime or failed dependency installation; do not claim the helper ran.

## Agent store

Use the session-provided agent store when available. Otherwise use a task-specific `.audit/pstack/<task-slug>/` directory under the target workspace. Resolve and record its absolute path, pass it to workers, and reuse it on session pickup. Keep plans under its `docs/` and orchestration state under `orchestrate/<project-slug>/`, unless the user or existing workflow supplies a destination. Pass that orchestration directory through `--store` or `ORCH_STORE` on every `orch` invocation. Keep these task artifacts local unless publication is requested; never write them into the installed plugin cache.

## Subagent fields

| Cursor | Codex |
| --- | --- |
| `subagent_type: generalPurpose` | Use the default agent type. Omit Cursor's `subagent_type`. |
| `poteto-agent`, `comment-sicko` | Read `<pstack>/agents/<name>.md` and include its instructions in a fresh worker's brief. These Markdown files are prompts, not registered Codex agent types. Give the worker the absolute paths to this adapter and `<pstack>/skills/poteto-mode/SKILL.md`, and tell it to read the adapter first. A `poteto-agent` must then read poteto-mode before working. |
| `readonly: true` | Omit the field and explicitly instruct the worker to inspect and report without editing. Compare `git status` before and after. This is a task constraint, not a separate sandbox; workers inherit session permissions. |
| `readonly: false` | Omit. Use the tools and MCP servers available to the worker. |
| `environment: "cloud"` | For isolated local work, create a separate git worktree per worker and give it the absolute path and starting branch or commit. Never switch a shared checkout's branch for a worker. This does not provide a hosted cloud machine. |
| `environment: "local"` | Omit; name the working directory and owned files in the brief. |
| `cloud_base_branch: <b>` | Use `<b>` as the base of that worker's worktree. |
| `run_in_background: true` | Omit. Spawning returns an agent identifier; collect results before dependent work. |
| `resume` | Prefer a fresh worker with the consolidated brief and prior result. When poteto-mode permits reuse, use the session's follow-up or resume tool with the returned identifier. |
| `file_attachments` | List absolute file paths in the brief. |

## Models

| Cursor | Codex |
| --- | --- |
| A `claude-*` or `grok-*` slug | Use the inherited session model and say once that the requested provider is unavailable. Do not pass a Cursor provider slug to Codex. |
| A `gpt-*` slug | Use it only if the session confirms that exact model is available. Cursor effort and `-fast` suffixes are not Codex model identifiers. |
| `auto` or `inherit-parent` | Omit model and effort overrides. Codex's configured agent defaults, if any, still apply. |
| A role value `<model> <effort>` | Pass the confirmed model and effort through the fields the spawn schema actually supports, such as `model` and `reasoning_effort`. When overrides require a fresh context, use `fork_turns: "none"` and a complete brief. If the tool cannot set them, inherit and report that limit. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | `$CODEX_HOME/pstack-models.md`, defaulting to `~/.codex/pstack-models.md`. Read it explicitly when loading this adapter; Codex does not automatically load arbitrary rule files. Missing role lines use the skill defaults mapped through this table. |

Keep one worker per panel entry, including repeated `inherit-parent` entries. When different providers are unavailable, use fresh independent workers and disclose that the panel used the same model. Do not claim a cross-model review took place.

## setup-pstack

Follow setup-pstack's role selection and confirmation steps with these changes:

- Detect only models and reasoning levels confirmed by the current session or its supported model listing. Record explicit choices as `<model> <effort>`, with effort last, and only when the spawn tool can apply them. Never infer availability from a model name in the Cursor guide.
- Map unavailable default models to `inherit-parent`, preserving panel list lengths. If model enumeration or overrides are unavailable, offer the inherited model and explain that the budget cannot change its effort. Setup can still save this configuration.
- Apply the chosen budget only to explicit model choices. Use that model's highest confirmed effort at or below the target; aliases retain inherited settings. Keep the skill's validation and confirmation steps.
- Write `$CODEX_HOME/pstack-models.md` (default `~/.codex/pstack-models.md`) with no frontmatter, the comment lines, the `# budget` line, and the same role labels as step 5. Overwrite only this pstack-owned file. Do not put role lines in `AGENTS.md` or rewrite `config.toml`.
- Say that pstack reads this file when loading its adapter in a new session. Re-running setup updates the current session's choices too.

## Paths and skill metadata

| Cursor | Codex |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.agents/skills/`, `~/.agents/skills/`. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Resolve files from `<pstack>`. Codex plugin caches normally live under `$CODEX_HOME/plugins/` (default `~/.codex/plugins/`); the Codex manifest is `.codex-plugin/plugin.json`. Pass resolved paths to workers rather than searching other installed versions. |
| `.cursor/rules/*.mdc`, always-applied rules | Project `AGENTS.md` or the user-level `$CODEX_HOME/AGENTS.md`. Merge only the requested instruction into existing content. The model rule is the exception above. |
| `disable-model-invocation: true` | Add `agents/openai.yaml` within that skill with `policy.allow_implicit_invocation: false`. The generated plugin already does this. Preserve this setting when `automate-me` or another workflow creates a manual-only skill. Explicit invocation and reading routed skills by path still work. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | Read `<pstack>/<path>` when it exists, including `README.md` and `docs/guide/`. Give the URL only when the user needs a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | Prefer session-history tools scoped to the active workspace and session. For local JSONL rollouts, use the procedure below. |

Local Codex rollouts may live under `$CODEX_HOME/sessions/` (default `~/.codex/sessions/`). They share one tree across projects. Inspect only each candidate's `session_meta` metadata first and retain files whose `payload.cwd` resolves to this workspace. Filter by workspace **before** sorting by modification time or limiting the result count. Read message bodies only from the matching sessions, and use the current session identifier for reflect or show-me-your-work rather than assuming the newest file is this chat. Include other worktrees only when explicitly in scope. If history is stored in another format or unavailable, report that and use the supplied context; do not search unrelated chats or global `history.jsonl`.

The bundled `scripts/worktree-audit.sh` still scans Cursor transcripts. Its `LAST_CHAT` column does not establish Codex activity, and its `safe` bucket is only a suggestion. Before cleanup, check the active and pinned Codex sessions and their worktrees as the playbook requires. Hold a candidate when you cannot establish that it is unused.

## Cursor-only features

When a step needs an unavailable Cursor feature, write `Skipped in Codex: <step>. <reason>.` and continue with independent work. Identify missing outputs for dependent steps; do not invent URLs, credentials, or verification results. Report a required proof that could not run as incomplete.

| Cursor | Codex |
| --- | --- |
| Cursor Automations, routine calls, `update_state`, `api2.cursor.sh/automations`, routine wakes, `SendToUser` | Skip the unavailable integration with the line above. |
| Bugbot | Read existing GitHub checks and review comments with the forge command. Skip starting, configuring, or waiting for Bugbot when the PR has no Bugbot integration. |
| Cursor cloud agents | Use worktrees for local isolation as above. Skip operations requiring Cursor's hosted machine or dashboard. |
| A built-in PR tool | Use the available forge command, such as `gh pr create`, within the user's authorization. |
| Cursor Custom Modes or `/loop` | Follow the corresponding skill directly for the current task. Do not promise recurring execution without an available scheduling tool and authorization. |

Format references: [plugin packaging](https://developers.openai.com/plugins/build/plugins), [skill metadata](https://learn.chatgpt.com/docs/build-skills), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
