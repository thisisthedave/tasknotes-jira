# Codex porting guide: Jira import companion plugin

This document is the implementation handoff for moving Jira import out of the TaskNotes fork and into this standalone companion plugin.

## Repositories and reference points

- Target repository: `C:\Users\magel\AppData\Roaming\obsidian\Obsidian Sandbox\.obsidian\plugins\tasknotes-jira`
- TaskNotes reference repository: `C:\Users\magel\AppData\Roaming\obsidian\Obsidian Sandbox\.obsidian\plugins\tasknotes`
- Reference branch: `feature/jira-issue-import`
- Reference branch tip when this guide was written: `a23a1a1d` (`Jira backlinks always use JIRA:PROJ-1234 macro`)
- Reference base: `main` at `7011e683`
- Combined keyboard/Jira branch: `integration/taskview-and-jira` (not the clean source for extracting Jira-only changes)

Before editing, read this repository’s `AGENTS.md` completely. Then inspect both worktrees and do not overwrite unrelated or uncommitted changes.

Useful read-only commands from the target repository:

```powershell
git -C "..\tasknotes" status --short --branch
git -C "..\tasknotes" log --oneline main..feature/jira-issue-import
git -C "..\tasknotes" diff --name-status main...feature/jira-issue-import
git -C "..\tasknotes" show feature/jira-issue-import:src/integrations/jira/JiraIssueAdapter.ts
```

Do not check out or modify the TaskNotes reference repository merely to read the feature. Prefer `git show`, `git diff`, and semantic navigation against the existing checkout.

## Objective

Implement Jira-to-TaskNotes import in this repository as a companion plugin. Preserve the behavior of the Jira feature branch while moving ownership of commands, settings, mapping, previews, persistence, and styles into `tasknotes-jira`.

The companion plugin must integrate through public or explicitly supported runtime APIs. It must not import TaskNotes source files at runtime, access `plugin.taskService`, patch TaskNotes settings, or copy internal TaskNotes services into this repository.

## Required dependencies and runtime boundaries

### TaskNotes

- Obsidian plugin ID: `tasknotes`
- Obtain it with `app.plugins.getPlugin("tasknotes")` through a small structural adapter and runtime guards.
- TaskNotes exposes a public runtime API on its plugin instance. The reference declarations are in:
  - `src/api/runtime-api.ts`
  - `src/api/TaskNotesAPI.ts`
  - `src/main.ts` (`api` property)
- The public API includes `createTask(taskData, context?)`, which applies current TaskNotes creation defaults and returns the created task.
- Define only the minimal interfaces required by this plugin. Do not copy the entire TaskNotes runtime API or depend on private implementation types.
- Check the API version/capability before importing. If the needed API is not available, show a useful dependency/version notice.

### Jira Issue

- Obsidian plugin ID: `obsidian-jira-issue`
- The required API is structurally equivalent to `plugin.api.base.getIssue(issueKey)`.
- Jira authentication and network requests remain owned by Jira Issue. Never read, duplicate, log, or persist its credentials.
- Keep runtime response validation at the adapter boundary.

Obsidian manifests cannot enforce companion-plugin dependencies. Detect both plugins at runtime and fail gracefully.

## Reference commits

Review these commits in order:

1. `87641c80` — command, dependency adapter, and import service
2. `287a3e74` — configurable field mapping and persistence
3. `02d3ec9f` — sample issue preview and raw JSON viewer
4. `c8f7815e` — raw JSON copy action
5. `e621094f` — Jira backlink and active-note project behavior
6. `a23a1a1d` — canonical `JIRA:PROJ-1234` backlink; this supersedes direct URL construction

Use the final branch state as authoritative when an earlier commit conflicts with a later one.

## Source-to-target port map

Reference files in TaskNotes:

- `src/integrations/jira/JiraIssueAdapter.ts`
  - Port into a target-side Jira dependency adapter.
- `src/integrations/jira/JiraFieldMapping.ts`
  - Port the pure path lookup, templates, coercion, list merging, remapping, rich-text conversion, preview resolution, and `JIRA:KEY` insertion.
  - Replace TaskNotes internal types with minimal companion-plugin DTOs.
- `src/services/JiraImportService.ts`
  - Redesign to fetch through the Jira adapter and create through a TaskNotes public-API adapter.
- `src/commands/jiraImportCommand.ts`
  - Port the command interaction and notices into this plugin.
- `src/settings/tabs/jiraMappingSettings.ts`
  - Port into this plugin’s own settings tab and split it into smaller modules if practical.
- `src/settings/defaults.ts`, `src/settings/settingsPersistence.ts`, and `src/types/settings.ts`
  - Extract only Jira mapping settings into this plugin’s own `loadData()` / `saveData()` model.
- `styles/settings-view.css`
  - Extract only `.tasknotes-jira-*` rules and rename/scope selectors for this plugin.
- `tests/unit/**/Jira*.test.ts` and `tests/unit/settings/jiraMappingSettings.test.ts`
  - Recreate the relevant tests in the target project after adding a test runner.

Do not port TaskNotes command registration, localization trees, settings tabs, or persistence wholesale. Rebuild those pieces using this plugin’s own lifecycle and data.

## Recommended target structure

```text
src/
  main.ts
  commands/
    importJiraIssue.ts
  dependencies/
    JiraIssueAdapter.ts
    TaskNotesAdapter.ts
  jira/
    JiraFieldMapping.ts
    JiraImportService.ts
    types.ts
  settings/
    settings.ts
    JiraMappingSettingTab.ts
  ui/
    textInputModal.ts
```

Keep `src/main.ts` limited to lifecycle, settings loading, dependency checks, command registration, and settings-tab registration.

## Behavioral requirements

1. Register a stable command such as `import-jira-issue-as-task`.
2. Validate Jira keys before calling the Jira plugin.
3. Fetch exactly once per import and validate the returned key, fields object, and summary.
4. Support mapping sources with `path`, `template`, `fixed`, and `off` modes.
5. Support list merging/deduplication, enum remaps, Jira rich text, and user-defined TaskNotes properties.
6. Persist versioned mapping settings only in this plugin’s `data.json`.
7. Provide an explicit sample-issue fetch with idle/loading/success/error states.
8. Keep the sample key and payload ephemeral. Never send them to `saveData()`.
9. Render raw JSON as inert text, keep it collapsed by default, cap the displayed payload, make the viewer vertically resizable, and copy the complete JSON with a Lucide `copy` button.
10. Always prepend `JIRA:${issue.key}` to mapped details unless the same macro already exists. Preserve Markdown details and make the operation idempotent.
11. Submit mapped data through TaskNotes’ public `createTask` API so TaskNotes owns defaults, templates, filename sanitization, file creation, cache updates, and events.
12. Preserve explicitly mapped projects. For active-note project behavior, first determine whether TaskNotes exposes the relevant setting and link-generation behavior through its public API. If it does not, either:
    - add a clearly documented companion-plugin setting with equivalent behavior, or
    - propose a minimal upstream TaskNotes API capability.
   Do not reach into private TaskNotes fields as a shortcut.
13. Provide clear notices for missing/incompatible TaskNotes, missing/incompatible Jira Issue, invalid keys, fetch failures, and task-creation failures.
14. Avoid logging full Jira payloads because they may contain sensitive data.

## Important redesign notes

- The Jira feature branch was implemented inside TaskNotes and can call internal services. The companion plugin cannot. Adapters are required on both dependency boundaries.
- TaskNotes’ public `createTask` API replaces the feature branch’s direct use of `plugin.taskService`.
- The feature branch stores Jira mapping under TaskNotes settings. The companion plugin must own and version these settings itself.
- TaskNotes user-field metadata may require a public API query. Inspect the runtime model/catalog/settings APIs before designing this. If no supported metadata endpoint exists, do not infer private shapes; document the missing capability and choose a safe reduced UI or propose an upstream API addition.
- The final backlink behavior is the Jira plugin macro `JIRA:KEY`, not a constructed `/browse/KEY` Markdown URL.
- Sample preview rendering must use text nodes or token spans populated with `textContent`; never inject issue JSON with `innerHTML`.

## Template cleanup

Before feature implementation:

- Change `manifest.json` from `sample-plugin` to the permanent plugin ID `tasknotes-jira` before any release.
- Replace sample name, description, author metadata, and funding URL.
- Update `package.json` name and description.
- Replace sample `src/main.ts` and `src/settings.ts`; remove the demo ribbon, modal, click listener, interval, and placeholder settings.
- Keep the current npm/esbuild toolchain unless there is a concrete reason to change it.
- Do not commit generated `main.js`, source maps, or `node_modules`.

## Testing and verification

Add a lightweight Jest or Vitest setup suitable for TypeScript and DOM tests. At minimum cover:

- Jira key normalization and invalid keys
- Missing/incompatible dependency APIs
- Malformed Jira responses
- Safe own-property path lookup and prototype-pollution rejection
- Template rendering and missing values
- Scalar coercion, list flattening/deduplication, enum remapping, and user fields
- Jira rich-text conversion
- Mapping normalization and persistence migration
- Preview value/missing/empty/invalid states
- Loading and error UI
- Raw JSON escaping, truncation, resizing markup/classes, and clipboard success/failure
- No persistence of sample issue keys or payloads
- `JIRA:KEY` details preservation and duplicate prevention
- TaskNotes adapter capability/version checks
- Task creation calls made once with expected mapped data
- Explicit project precedence and whichever supported active-note project policy is selected

Run:

```bash
npm run lint
npm run build
```

Also run the new unit-test command and manually test in the sandbox vault with all three plugins enabled.

## Completion criteria

- The sample plugin behavior and naming are gone.
- Both dependencies are validated without crashing startup.
- A Jira issue can be previewed and imported into TaskNotes through public APIs.
- Settings survive reload, while sample data does not.
- Missing dependencies and failures produce actionable notices.
- Build, lint, tests, and a manual Obsidian import pass.
- README dependency, installation, privacy, and troubleshooting information matches the implemented behavior.
