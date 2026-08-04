import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type { SettingDefinition, SettingDefinitionItem, SettingGroupItem } from 'obsidian';
import type TaskNotesJiraPlugin from '../main';
import { JiraIssueAdapter } from '../dependencies/JiraIssueAdapter';
import { TaskNotesAdapter } from '../dependencies/TaskNotesAdapter';
import { buildJiraMappingPreview, createDefaultJiraMappingSettings, JIRA_MAPPING_TARGETS } from '../jira/JiraFieldMapping';
import type { JiraIssue, JiraValueSource, JiraValueSourceMode } from '../jira/types';
import { parseJiraEnumRemaps, serializeJiraIssuePreview } from './previewUtils';
const humanize = (value: string): string => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());

export class JiraMappingSettingTab extends PluginSettingTab {
	private sampleKey = '';
	private sample: JiraIssue | null = null;
	private sampleState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
	private sampleError = '';

	constructor(app: App, public plugin: TaskNotesJiraPlugin) { super(app, plugin); }

	/** Resolves a localized string from the plugin-owned translation resource. */
	private t(key: string, params?: Record<string, string | number>): string { return this.plugin.i18n.translate(key, params); }

	/** Localizes built-in TaskNotes field IDs while preserving user-defined field names. */
	private fieldLabel(label: string): string { return this.plugin.i18n.resolveKey(`settings.fields.${label}`) ?? humanize(label); }

	/** Returns localized labels for each supported Jira mapping source mode. */
	private modeLabels(): Record<JiraValueSourceMode, string> {
		return { path: this.t('settings.modes.path'), template: this.t('settings.modes.template'), fixed: this.t('settings.modes.fixed'), off: this.t('settings.modes.off') };
	}

	/**
	 * Describes the settings for Obsidian 1.13+ search and rendering.
	 * The callbacks retain the custom mapping and preview controls used by the legacy tab.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		// Render callbacks are the fulcrum of the migration: every custom row becomes searchable without losing its dynamic behavior.
		const definitions: SettingDefinitionItem[] = [
			{
				name: this.t('settings.activeProject.name'),
				desc: this.t('settings.activeProject.description'),
				render: (setting) => { setting.addToggle((toggle) => toggle.setValue(this.plugin.settings.useActiveNoteAsProject).onChange(async (value) => {
					this.plugin.settings.useActiveNoteAsProject = value;
					await this.plugin.saveSettings();
				})); },
			},
			{
				name: this.t('settings.sample.name'),
				desc: this.t('settings.sample.declarativeDescription'),
				render: (setting) => { setting.addText((input) => {
					input.setPlaceholder(this.t('import.issueKeyPlaceholder')).setValue(this.sampleKey).onChange((value) => { this.sampleKey = value; });
					input.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && this.sampleState !== 'loading') void this.fetchDeclarativeSample(); });
				}).addButton((button) => button.setButtonText(this.t(this.sampleState === 'loading' ? 'common.loading' : 'common.fetch')).setDisabled(this.sampleState === 'loading').onClick(() => void this.fetchDeclarativeSample())); },
			},
		];

		if (this.sampleState === 'error') definitions.push({ name: this.t('settings.sample.errorName'), desc: this.sampleError, searchable: false });
		if (this.sample) definitions.push({ name: this.t('settings.preview.resolved'), aliases: [this.t('settings.preview.alias'), this.t('settings.preview.raw')], render: (setting) => this.renderPreview(setting.settingEl, this.sample!) });

		definitions.push({
			type: 'group',
			heading: this.t('settings.fieldSources.heading'),
			items: [
				{
					name: this.t('settings.fieldSources.resetName'),
					desc: this.t('settings.fieldSources.resetDescription'),
					render: (setting) => { setting.addButton((button) => button.setButtonText(this.t('settings.fieldSources.resetButton')).onClick(async () => {
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
			heading: this.t('settings.userFields'),
			items: userFields.flatMap((field) => this.getSourceDefinitions(field.displayName, this.plugin.settings.jiraMapping.userFields[field.id] ??= [], field.type === 'list')),
		});

		definitions.push({
			type: 'group',
			heading: this.t('settings.valueRemapping.heading'),
			items: (['status', 'priority', 'contexts'] as const).map((key) => ({
				name: this.fieldLabel(key),
				desc: this.t('settings.valueRemapping.description'),
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
			name: index ? this.t('settings.fieldSources.source', { label: this.fieldLabel(label), number: index + 1 }) : this.fieldLabel(label),
			aliases: Object.values(this.modeLabels()),
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					Object.entries(this.modeLabels()).forEach(([mode, optionLabel]) => { dropdown.addOption(mode, optionLabel); });
					dropdown.setValue(source.mode).onChange(async (mode) => { source.mode = mode as JiraValueSourceMode; await this.plugin.saveSettings(); this.updateDeclarativeSettings(); });
				}).addText((input) => input.setValue(source.value).setDisabled(source.mode === 'off').setPlaceholder(this.t(source.mode === 'template' ? 'settings.placeholders.template' : 'settings.placeholders.path')).onChange(async (value) => { source.value = value; await this.plugin.saveSettings(); }));
				if (list) setting.addExtraButton((button) => button.setIcon('trash-2').setTooltip(this.t('common.removeSource')).onClick(async () => { sources.splice(index, 1); await this.plugin.saveSettings(); this.updateDeclarativeSettings(); }));
			},
		}));
		if (list || !sources.length) definitions.push({
			name: this.t('settings.fieldSources.add', { label: this.fieldLabel(label) }),
			searchable: false,
			render: (setting) => { setting.addButton((button) => button.setButtonText(this.t('common.addSource')).onClick(async () => { sources.push({ mode: 'path', value: '' }); await this.plugin.saveSettings(); this.updateDeclarativeSettings(); })); },
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
		catch { this.sample = null; this.sampleState = 'error'; this.sampleError = this.t('settings.sample.fetchError'); }
		this.updateDeclarativeSettings();
	}
	display(): void {
		const container = this.containerEl; container.empty(); container.addClass('tasknotes-jira-settings'); let sampleKey = ''; let sample: JiraIssue | null = null; let state: 'idle' | 'loading' | 'success' | 'error' = 'idle'; let error = '';
		const render = (): void => {
			container.empty(); new Setting(container).setName(this.t('settings.title')).setDesc(this.t('settings.description')).setHeading();
			new Setting(container).setName(this.t('settings.activeProject.name')).setDesc(this.t('settings.activeProject.description')).addToggle((toggle) => toggle.setValue(this.plugin.settings.useActiveNoteAsProject).onChange(async (value) => { this.plugin.settings.useActiveNoteAsProject = value; await this.plugin.saveSettings(); }));
			new Setting(container).setName(this.t('settings.sample.name')).setDesc(this.t('settings.sample.description')).addText((text) => { text.setPlaceholder(this.t('import.issueKeyPlaceholder')).setValue(sampleKey).onChange((value) => { sampleKey = value; }); text.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && state !== 'loading') void fetchSample(); }); }).addButton((button) => button.setButtonText(this.t(state === 'loading' ? 'common.loading' : 'common.fetch')).setDisabled(state === 'loading').onClick(() => void fetchSample()));
			if (state === 'error') container.createDiv({ cls: 'tasknotes-jira-preview__error', text: error });
			if (sample) this.renderPreview(container, sample);
			new Setting(container).setName(this.t('settings.fieldSources.heading')).setDesc(this.t('settings.fieldSources.description')).setHeading().addButton((button) => button.setButtonText(this.t('settings.fieldSources.resetButton')).onClick(() => { this.plugin.settings.jiraMapping = createDefaultJiraMappingSettings(); void this.plugin.saveSettings().then(render); }));
			for (const target of JIRA_MAPPING_TARGETS) this.renderSources(container, target.id, this.plugin.settings.jiraMapping.fields[target.id] ??= [], target.kind === 'list', render);
			const users = TaskNotesAdapter.fromApp(this.app).getUserFields(); if (users.length) { new Setting(container).setName(this.t('settings.userFields')).setHeading(); for (const field of users) this.renderSources(container, field.displayName, this.plugin.settings.jiraMapping.userFields[field.id] ??= [], field.type === 'list', render); }
			new Setting(container).setName(this.t('settings.valueRemapping.heading')).setDesc(this.t('settings.valueRemapping.description')).setHeading(); for (const key of ['status', 'priority', 'contexts'] as const) new Setting(container).setName(this.fieldLabel(key)).addTextArea((area) => { area.inputEl.rows = 4; area.setValue(this.plugin.settings.jiraMapping.enumRemaps[key].map((entry) => `${entry.taskValue} = ${entry.jiraValues.join(', ')}`).join('\n')).onChange(async (value) => { this.plugin.settings.jiraMapping.enumRemaps[key] = parseJiraEnumRemaps(value); await this.plugin.saveSettings(); if (sample) render(); }); });
		};
		const fetchSample = async (): Promise<void> => { state = 'loading'; error = ''; render(); try { sample = await JiraIssueAdapter.fromApp(this.app).getIssue(sampleKey); state = 'success'; } catch { sample = null; state = 'error'; error = this.t('settings.sample.fetchError'); } render(); };
		render();
	}
	private renderSources(container: HTMLElement, label: string, sources: JiraValueSource[], list: boolean, rerender: () => void): void {
		if (!list && !sources.length) sources.push({ mode: 'off', value: '' });
		if (!sources.length) new Setting(container).setName(this.fieldLabel(label)).setDesc(this.t('settings.fieldSources.none')).addButton((button) => button.setButtonText(this.t('common.addSource')).onClick(() => { sources.push({ mode: 'path', value: '' }); void this.plugin.saveSettings().then(rerender); }));
		sources.forEach((source, index) => { const setting = new Setting(container).setName(index ? this.t('settings.fieldSources.source', { label: this.fieldLabel(label), number: index + 1 }) : this.fieldLabel(label)); setting.addDropdown((dropdown) => { Object.entries(this.modeLabels()).forEach(([mode, optionLabel]) => { dropdown.addOption(mode, optionLabel); }); dropdown.setValue(source.mode).onChange((mode) => { source.mode = mode as JiraValueSourceMode; void this.plugin.saveSettings().then(rerender); }); }).addText((input) => input.setValue(source.value).setDisabled(source.mode === 'off').setPlaceholder(this.t(source.mode === 'template' ? 'settings.placeholders.template' : 'settings.placeholders.path')).onChange((value) => { source.value = value; void this.plugin.saveSettings(); })); if (list) setting.addExtraButton((button) => button.setIcon('trash-2').setTooltip(this.t('common.removeSource')).onClick(() => { sources.splice(index, 1); void this.plugin.saveSettings().then(rerender); })); });
		if (list && sources.length) new Setting(container).addButton((button) => button.setButtonText(this.t('common.addSource')).onClick(() => { sources.push({ mode: 'path', value: '' }); void this.plugin.saveSettings().then(rerender); }));
	}
	private renderPreview(container: HTMLElement, issue: JiraIssue): void {
		const preview = container.createDiv('tasknotes-jira-preview'); new Setting(preview).setName(this.t('settings.preview.resolved')).setHeading(); const values = preview.createDiv('tasknotes-jira-preview__values');
		for (const entry of buildJiraMappingPreview(issue, this.plugin.settings.jiraMapping, TaskNotesAdapter.fromApp(this.app).getUserFields())) { const row = values.createDiv('tasknotes-jira-preview__row'); row.createDiv({ cls: 'tasknotes-jira-preview__label', text: this.fieldLabel(entry.label) }); const shown = entry.status === 'missing' ? this.t('settings.preview.missing') : entry.status === 'invalid' ? this.t('settings.preview.invalid') : typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value); row.createEl('code', { cls: `tasknotes-jira-preview__value is-${entry.status}`, text: (shown ?? '').slice(0, 500) }); }
		const serialized = serializeJiraIssuePreview(issue); const details = preview.createEl('details', { cls: 'tasknotes-jira-preview__raw' }); details.createEl('summary', { text: this.t('settings.preview.raw') }); details.createDiv({ cls: 'setting-item-description', text: this.t('settings.preview.rawDescription') }); const toolbar = details.createDiv('tasknotes-jira-preview__toolbar'); const copy = toolbar.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': this.t('settings.preview.copyAria') } }); setIcon(copy, 'copy'); copy.addEventListener('click', (event) => { event.preventDefault(); void navigator.clipboard.writeText(JSON.stringify(issue, null, 2)).then(() => new Notice(this.t('settings.preview.copied'))).catch(() => new Notice(this.t('settings.preview.copyFailed'))); }); details.createEl('pre', { text: serialized.text }); if (serialized.truncated) details.createDiv({ cls: 'setting-item-description', text: this.t('settings.preview.truncated') });
	}
}
