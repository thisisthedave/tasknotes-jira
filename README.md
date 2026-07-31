# TaskNotes Jira

TaskNotes Jira is an Obsidian companion plugin that imports Jira issues as TaskNotes tasks. It connects the Jira data supplied by the Jira Issue plugin to TaskNotes’ task-creation API, with configurable field mapping, import previews, and Jira backlinks.

## Requirements

TaskNotes Jira depends on two other Obsidian plugins:

- **TaskNotes** [`tasknotes`](https://community.obsidian.md/plugins/tasknotes) creates and manages the imported task notes.
- **Jira Issue** [`obsidian-jira-issue`](https://community.obsidian.md/plugins/obsidian-jira-issue) connects to Jira and retrieves issue data.

Install, enable, and configure both dependencies before using TaskNotes Jira. In particular, verify that Jira Issue can load an issue from your Jira account and that TaskNotes can create a normal task.

## Planned features

- Import a Jira issue by key from the Obsidian command palette.
- Map Jira JSON paths, templates, fixed values, and disabled sources to TaskNotes properties.
- Merge multiple Jira sources into list-valued TaskNotes properties.
- Remap Jira status, priority, and context values.
- Map Jira data into TaskNotes user-defined fields.
- Fetch a sample issue and preview the values produced by the current mapping.
- Inspect, resize, and copy a sample issue’s raw JSON without persisting it.
- Add a `JIRA:PROJ-1234` backlink to the imported task while preserving the mapped description.
- Use TaskNotes’ existing creation defaults, templates, and safe filename generation.
- Use the active note as the project when the relevant TaskNotes default is enabled, unless the Jira mapping explicitly supplies a project.

## Installation

To install from source:

1. Install and configure TaskNotes and Jira Issue.
2. Download or build `main.js`, `manifest.json`, and `styles.css` for TaskNotes Jira.
3. Place the files in `<vault>/.obsidian/plugins/tasknotes-jira/`.
4. Reload Obsidian.
5. Enable **TaskNotes Jira** under **Settings → Community plugins**.

## Usage

After the dependencies are configured:

1. Open **Settings → TaskNotes Jira** and configure the Jira-to-TaskNotes field mappings.
2. Optionally fetch a sample issue to verify the resolved values.
3. Run **Import Jira issue as task** from the command palette.
4. Enter an issue key such as `PROJ-1234`.

The companion plugin retrieves the issue through Jira Issue and submits the mapped task through TaskNotes’ public API. TaskNotes remains responsible for applying task defaults, generating a safe filename, writing the note, and updating its cache.

## Privacy and security

TaskNotes Jira does not implement Jira authentication and should not store Jira credentials. Jira requests and account configuration are delegated to Jira Issue. Sample issue data is held only in memory for the settings preview and is not saved in this plugin’s settings.

Jira issues can contain sensitive project information. Review raw JSON before copying or sharing it, and protect your Obsidian vault and plugin data accordingly. This plugin does not include telemetry.

## Compatibility

This plugin relies on runtime APIs exposed by TaskNotes and Jira Issue. Compatible minimum versions will be documented before the first release. If either dependency is missing or exposes an incompatible API, imports should be disabled with an explanatory notice rather than failing silently.

## Troubleshooting

- **The import command reports that Jira Issue is unavailable:** Enable Jira Issue and confirm that its Jira account is configured.
- **The import command reports that TaskNotes is unavailable:** Enable TaskNotes and confirm that it can create a task normally.
- **A mapping produces no value:** Load the issue in the mapping preview and compare the configured path with the raw JSON.

## Development

```bash
npm install
npm run dev
```

Run `npm run build` for a production bundle and `npm run lint` before submitting changes. The required Obsidian release artifacts are `main.js`, `manifest.json`, and `styles.css`.

## License

See [LICENSE](LICENSE).
