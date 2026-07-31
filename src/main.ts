import { Notice, Plugin } from 'obsidian';
import { executeJiraImport } from './commands/importJiraIssue';
import { JiraIssueAdapter } from './dependencies/JiraIssueAdapter';
import { TaskNotesAdapter } from './dependencies/TaskNotesAdapter';
import { JiraMappingSettingTab } from './settings/JiraMappingSettingTab';
import { DEFAULT_SETTINGS, normalizeSettings, type TaskNotesJiraSettings } from './settings/settings';

export default class TaskNotesJiraPlugin extends Plugin {
	settings: TaskNotesJiraSettings = DEFAULT_SETTINGS;
	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.addCommand({ id: 'import-jira-issue-as-task', name: 'Import Jira issue as task', callback: () => void executeJiraImport(this) });
		this.addSettingTab(new JiraMappingSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			if (!TaskNotesAdapter.fromApp(this.app).isAvailable()) new Notice('TaskNotes Jira: enable a compatible TaskNotes version to import issues.', 8000);
			if (!JiraIssueAdapter.fromApp(this.app).isAvailable()) new Notice('TaskNotes Jira: enable and configure Jira Issue to import issues.', 8000);
		});
	}
	async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}
