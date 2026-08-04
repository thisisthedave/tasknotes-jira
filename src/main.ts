import { Notice, Plugin } from 'obsidian';
import { executeJiraImport } from './commands/importJiraIssue';
import { JiraIssueAdapter } from './dependencies/JiraIssueAdapter';
import { TaskNotesAdapter } from './dependencies/TaskNotesAdapter';
import { JiraMappingSettingTab } from './settings/JiraMappingSettingTab';
import { DEFAULT_SETTINGS, normalizeSettings, type TaskNotesJiraSettings } from './settings/settings';
import { createI18nService, type I18nService } from './i18n';

/** Reads Obsidian's document language without requiring a newer host API. */
function getHostLocale(): string {
	return document.documentElement.lang || navigator.language || 'en';
}

export default class TaskNotesJiraPlugin extends Plugin {
	settings: TaskNotesJiraSettings = DEFAULT_SETTINGS;
	i18n: I18nService = createI18nService();
	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		// Use Obsidian's configured UI language so this companion follows TaskNotes and the host application.
		this.i18n = createI18nService({ initialLocale: 'system', getSystemLocale: getHostLocale });
		this.addCommand({ id: 'import-jira-issue-as-task', name: this.i18n.translate('commands.importJiraIssue'), callback: () => void executeJiraImport(this) });
		this.addSettingTab(new JiraMappingSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			if (!TaskNotesAdapter.fromApp(this.app).isAvailable()) new Notice(this.i18n.translate('startup.tasknotesUnavailable'), 8000);
			if (!JiraIssueAdapter.fromApp(this.app).isAvailable()) new Notice(this.i18n.translate('startup.jiraUnavailable'), 8000);
		});
	}
	async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}
