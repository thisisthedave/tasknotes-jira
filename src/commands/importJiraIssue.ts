import { Notice, normalizePath } from 'obsidian';
import type TaskNotesJiraPlugin from '../main';
import { JiraIssueAdapter } from '../dependencies/JiraIssueAdapter';
import { TaskNotesAdapter } from '../dependencies/TaskNotesAdapter';
import { JiraImportError, JiraImportService } from '../jira/JiraImportService';
import type { TaskCreationData } from '../jira/types';
import { showTextInputModal } from '../ui/textInputModal';

function addActiveProject(plugin: TaskNotesJiraPlugin, data: TaskCreationData): TaskCreationData {
	if (!plugin.settings.useActiveNoteAsProject || data.projects?.length) return data; const file = plugin.app.workspace.getActiveFile(); if (!file) return data;
	const target = normalizePath(file.path.replace(/\.md$/i, '')); return { ...data, projects: [`[[${target}|${file.basename}]]`] };
}
export async function executeJiraImport(plugin: TaskNotesJiraPlugin): Promise<void> {
	const key = await showTextInputModal(plugin.app, plugin.i18n); if (!key) return;
	const service = new JiraImportService(JiraIssueAdapter.fromApp(plugin.app), TaskNotesAdapter.fromApp(plugin.app), plugin.settings.jiraMapping, TaskNotesAdapter.fromApp(plugin.app).getUserFields(), (data) => addActiveProject(plugin, data));
	try { const task = await service.importIssue(key); new Notice(plugin.i18n.translate('import.success', { title: typeof task.title === 'string' ? task.title : key.trim().toUpperCase() })); }
	catch (error) {
		const errorKeys: Record<string, string> = { 'invalid-issue-key': 'import.errors.invalidIssueKey', 'jira-unavailable': 'import.errors.jiraUnavailable', 'tasknotes-unavailable': 'import.errors.tasknotesUnavailable', 'fetch-failed': 'import.errors.fetchFailed', 'creation-failed': 'import.errors.creationFailed' };
		new Notice(plugin.i18n.translate(error instanceof JiraImportError ? errorKeys[error.code] ?? 'import.errors.unknown' : 'import.errors.unknown'));
	}
}
