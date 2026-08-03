import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type { SettingDefinition, SettingDefinitionItem, SettingGroupItem } from 'obsidian';
import type TaskNotesJiraPlugin from '../main';
import { JiraIssueAdapter } from '../dependencies/JiraIssueAdapter';
import { TaskNotesAdapter } from '../dependencies/TaskNotesAdapter';
import { buildJiraMappingPreview, createDefaultJiraMappingSettings, JIRA_MAPPING_TARGETS } from '../jira/JiraFieldMapping';
import type { JiraIssue, JiraValueSource, JiraValueSourceMode } from '../jira/types';
import { parseJiraEnumRemaps, serializeJiraIssuePreview } from './previewUtils';
const MODE_LABELS: Record<JiraValueSourceMode, string> = { path: 'Jira path', template: 'Template', fixed: 'Fixed value', off: 'Disabled' };
const humanize = (value: string): string => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());

export class JiraMappingSettingTab extends PluginSettingTab {
	private sampleKey = '';
	private sample: JiraIssue | null = null;
	private sampleState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
	private sampleError = '';

	constructor(app: App, public plugin: TaskNotesJiraPlugin) { super(app, plugin); }

	/**
	 * Describes the settings for Obsidian 1.13+ search and rendering.
	 * The callbacks retain the custom mapping and preview controls used by the legacy tab.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		// Render callbacks are the fulcrum of the migration: every custom row becomes searchable without losing its dynamic behavior.
		const definitions: SettingDefinitionItem[] = [
			{
				name: 'Use active note as project',
				desc: 'When Jira does not map a project, add the active note as a wiki-link project.',
				render: (setting) => { setting.addToggle((toggle) => toggle.setValue(this.plugin.settings.useActiveNoteAsProject).onChange(async (value) => {
					this.plugin.settings.useActiveNoteAsProject = value;
					await this.plugin.saveSettings();
				})); },
			},
			{
				name: 'Sample issue',
				desc: 'Fetch explicitly to preview the current mapping. Sample keys and payloads remain in memory only.',
				render: (setting) => { setting.addText((input) => {
					input.setPlaceholder('PROJ-1234').setValue(this.sampleKey).onChange((value) => { this.sampleKey = value; });
					input.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && this.sampleState !== 'loading') void this.fetchDeclarativeSample(); });
				}).addButton((button) => button.setButtonText(this.sampleState === 'loading' ? 'Loading…' : 'Fetch').setDisabled(this.sampleState === 'loading').onClick(() => void this.fetchDeclarativeSample())); },
			},
		];

		if (this.sampleState === 'error') definitions.push({ name: 'Sample issue error', desc: this.sampleError, searchable: false });
		if (this.sample) definitions.push({ name: 'Resolved values', aliases: ['Jira preview', 'Raw Jira JSON'], render: (setting) => this.renderPreview(setting.settingEl, this.sample!) });

		definitions.push({
			type: 'group',
			heading: 'Field sources',
			items: [
				{
					name: 'Reset mappings',
					desc: 'Restore the default Jira-to-TaskNotes field sources.',
					render: (setting) => { setting.addButton((button) => button.setButtonText('Reset mappings').onClick(async () => {
						this.plugin.settings.jiraMapping = createDefaultJiraMappingSettings();
						await this.plugin.saveSettings();
						this.updateDeclarativeSettings();
					})); },
				},
				...JIRA_MAPPING_TARGETS.flatMap((target) => this.getSourceDefinitions(target.id, this.plugin.settings.jiraMapping.fields[target.id] ??= [], target.kind === 'list')),
			] satisfies SettingGroupItem[],
		});

		const userFields = TaskNotesAdapter.fromApp(this.app).getUserFields();
		if (userFields.length) definitions.push({
			type: 'group',
			heading: 'User-defined fields',
			items: userFields.flatMap((field) => this.getSourceDefinitions(field.displayName, this.plugin.settings.jiraMapping.userFields[field.id] ??= [], field.type === 'list')),
		});

		definitions.push({
			type: 'group',
			heading: 'Value remapping',
			items: (['status', 'priority', 'contexts'] as const).map((key) => ({
				name: humanize(key),
				desc: 'One per line: TaskNotes value = Jira value, alternate Jira value.',
				render: (setting: Setting) => { setting.addTextArea((area) => {
					area.inputEl.rows = 4;
					area.setValue(this.plugin.settings.jiraMapping.enumRemaps[key].map((entry) => `${entry.taskValue} = ${entry.jiraValues.join(', ')}`).join('\n')).onChange(async (value) => {
						this.plugin.settings.jiraMapping.enumRemaps[key] = parseJiraEnumRemaps(value);
						await this.plugin.saveSettings();
					});
				}); },
			})),
		});

		return definitions;
	}

	/** Builds searchable definitions for one scalar or list mapping target. */
	private getSourceDefinitions(label: string, sources: JiraValueSource[], list: boolean): SettingDefinition[] {
		if (!list && !sources.length) sources.push({ mode: 'off', value: '' });
		const definitions: SettingDefinition[] = sources.map((source, index) => ({
			name: index ? `${humanize(label)} source ${index + 1}` : humanize(label),
			aliases: ['Jira path', 'Template', 'Fixed value', 'Disabled'],
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					Object.entries(MODE_LABELS).forEach(([mode, optionLabel]) => { dropdown.addOption(mode, optionLabel); });
					dropdown.setValue(source.mode).onChange(async (mode) => { source.mode = mode as JiraValueSourceMode; await this.plugin.saveSettings(); this.updateDeclarativeSettings(); });
				}).addText((input) => input.setValue(source.value).setDisabled(source.mode === 'off').setPlaceholder(source.mode === 'template' ? '$key $fields.summary' : 'fields.summary').onChange(async (value) => { source.value = value; await this.plugin.saveSettings(); }));
				if (list) setting.addExtraButton((button) => button.setIcon('trash-2').setTooltip('Remove source').onClick(async () => { sources.splice(index, 1); await this.plugin.saveSettings(); this.updateDeclarativeSettings(); }));
			},
		}));
		if (list || !sources.length) definitions.push({
			name: `Add ${humanize(label)} source`,
			searchable: false,
			render: (setting) => { setting.addButton((button) => button.setButtonText('Add source').onClick(async () => { sources.push({ mode: 'path', value: '' }); await this.plugin.saveSettings(); this.updateDeclarativeSettings(); })); },
		});
		return definitions;
	}

	/** Refreshes declarative settings only on hosts that provide the Obsidian 1.13 API. */
	private updateDeclarativeSettings(): void {
		const update = (this as unknown as { update?: () => void }).update;
		update?.call(this);
	}

	/** Fetches the ephemeral sample used by the declarative settings preview. */
	private async fetchDeclarativeSample(): Promise<void> {
		this.sampleState = 'loading'; this.sampleError = ''; this.updateDeclarativeSettings();
		try { this.sample = await JiraIssueAdapter.fromApp(this.app).getIssue(this.sampleKey); this.sampleState = 'success'; }
		catch (caught) { this.sample = null; this.sampleState = 'error'; this.sampleError = caught instanceof Error ? caught.message : 'Could not fetch the sample issue.'; }
		this.updateDeclarativeSettings();
	}
	display(): void {
		const container = this.containerEl; container.empty(); container.addClass('tasknotes-jira-settings'); let sampleKey = ''; let sample: JiraIssue | null = null; let state: 'idle' | 'loading' | 'success' | 'error' = 'idle'; let error = '';
		const render = (): void => {
			container.empty(); new Setting(container).setName('TaskNotes Jira').setDesc('Map Jira issue data to TaskNotes fields. Sample keys and payloads remain in memory only.').setHeading();
			new Setting(container).setName('Use active note as project').setDesc('When Jira does not map a project, add the active note as a wiki-link project.').addToggle((toggle) => toggle.setValue(this.plugin.settings.useActiveNoteAsProject).onChange(async (value) => { this.plugin.settings.useActiveNoteAsProject = value; await this.plugin.saveSettings(); }));
			new Setting(container).setName('Sample issue').setDesc('Fetch explicitly to preview the current mapping.').addText((text) => { text.setPlaceholder('PROJ-1234').setValue(sampleKey).onChange((value) => { sampleKey = value; }); text.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && state !== 'loading') void fetchSample(); }); }).addButton((button) => button.setButtonText(state === 'loading' ? 'Loading…' : 'Fetch').setDisabled(state === 'loading').onClick(() => void fetchSample()));
			if (state === 'error') container.createDiv({ cls: 'tasknotes-jira-preview__error', text: error });
			if (sample) this.renderPreview(container, sample);
			new Setting(container).setName('Field sources').setDesc('Paths read Jira JSON. Templates interpolate $key and $fields.* tokens. List fields can merge sources.').setHeading().addButton((button) => button.setButtonText('Reset mappings').onClick(() => { this.plugin.settings.jiraMapping = createDefaultJiraMappingSettings(); void this.plugin.saveSettings().then(render); }));
			for (const target of JIRA_MAPPING_TARGETS) this.renderSources(container, target.id, this.plugin.settings.jiraMapping.fields[target.id] ??= [], target.kind === 'list', render);
			const users = TaskNotesAdapter.fromApp(this.app).getUserFields(); if (users.length) { new Setting(container).setName('User-defined fields').setHeading(); for (const field of users) this.renderSources(container, field.displayName, this.plugin.settings.jiraMapping.userFields[field.id] ??= [], field.type === 'list', render); }
			new Setting(container).setName('Value remapping').setDesc('One per line: TaskNotes value = Jira value, alternate Jira value.').setHeading(); for (const key of ['status', 'priority', 'contexts'] as const) new Setting(container).setName(humanize(key)).addTextArea((area) => { area.inputEl.rows = 4; area.setValue(this.plugin.settings.jiraMapping.enumRemaps[key].map((entry) => `${entry.taskValue} = ${entry.jiraValues.join(', ')}`).join('\n')).onChange(async (value) => { this.plugin.settings.jiraMapping.enumRemaps[key] = parseJiraEnumRemaps(value); await this.plugin.saveSettings(); if (sample) render(); }); });
		};
		const fetchSample = async (): Promise<void> => { state = 'loading'; error = ''; render(); try { sample = await JiraIssueAdapter.fromApp(this.app).getIssue(sampleKey); state = 'success'; } catch (caught) { sample = null; state = 'error'; error = caught instanceof Error ? caught.message : 'Could not fetch the sample issue.'; } render(); };
		render();
	}
	private renderSources(container: HTMLElement, label: string, sources: JiraValueSource[], list: boolean, rerender: () => void): void {
		if (!list && !sources.length) sources.push({ mode: 'off', value: '' });
		if (!sources.length) new Setting(container).setName(humanize(label)).setDesc('No sources configured.').addButton((button) => button.setButtonText('Add source').onClick(() => { sources.push({ mode: 'path', value: '' }); void this.plugin.saveSettings().then(rerender); }));
		sources.forEach((source, index) => { const setting = new Setting(container).setName(index ? `${humanize(label)} source ${index + 1}` : humanize(label)); setting.addDropdown((dropdown) => { Object.entries(MODE_LABELS).forEach(([mode, optionLabel]) => { dropdown.addOption(mode, optionLabel); }); dropdown.setValue(source.mode).onChange((mode) => { source.mode = mode as JiraValueSourceMode; void this.plugin.saveSettings().then(rerender); }); }).addText((input) => input.setValue(source.value).setDisabled(source.mode === 'off').setPlaceholder(source.mode === 'template' ? '$key $fields.summary' : 'fields.summary').onChange((value) => { source.value = value; void this.plugin.saveSettings(); })); if (list) setting.addExtraButton((button) => button.setIcon('trash-2').setTooltip('Remove source').onClick(() => { sources.splice(index, 1); void this.plugin.saveSettings().then(rerender); })); });
		if (list && sources.length) new Setting(container).addButton((button) => button.setButtonText('Add source').onClick(() => { sources.push({ mode: 'path', value: '' }); void this.plugin.saveSettings().then(rerender); }));
	}
	private renderPreview(container: HTMLElement, issue: JiraIssue): void {
		const preview = container.createDiv('tasknotes-jira-preview'); new Setting(preview).setName('Resolved values').setHeading(); const values = preview.createDiv('tasknotes-jira-preview__values');
		for (const entry of buildJiraMappingPreview(issue, this.plugin.settings.jiraMapping, TaskNotesAdapter.fromApp(this.app).getUserFields())) { const row = values.createDiv('tasknotes-jira-preview__row'); row.createDiv({ cls: 'tasknotes-jira-preview__label', text: humanize(entry.label) }); const shown = entry.status === 'missing' ? 'Missing' : entry.status === 'invalid' ? 'Invalid' : typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value); row.createEl('code', { cls: `tasknotes-jira-preview__value is-${entry.status}`, text: (shown ?? '').slice(0, 500) }); }
		const serialized = serializeJiraIssuePreview(issue); const details = preview.createEl('details', { cls: 'tasknotes-jira-preview__raw' }); details.createEl('summary', { text: 'Raw Jira JSON' }); details.createDiv({ cls: 'setting-item-description', text: 'Collapsed by default. The on-screen payload is capped; copy uses the complete payload.' }); const toolbar = details.createDiv('tasknotes-jira-preview__toolbar'); const copy = toolbar.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': 'Copy raw JSON' } }); setIcon(copy, 'copy'); copy.addEventListener('click', (event) => { event.preventDefault(); void navigator.clipboard.writeText(JSON.stringify(issue, null, 2)).then(() => new Notice('Copied Jira JSON.')).catch(() => new Notice('Could not copy Jira JSON.')); }); details.createEl('pre', { text: serialized.text }); if (serialized.truncated) details.createDiv({ cls: 'setting-item-description', text: 'Preview truncated.' });
	}
}
