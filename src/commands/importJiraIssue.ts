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
	const key = await showTextInputModal(plugin.app); if (!key) return;
	const service = new JiraImportService(JiraIssueAdapter.fromApp(plugin.app), TaskNotesAdapter.fromApp(plugin.app), plugin.settings.jiraMapping, TaskNotesAdapter.fromApp(plugin.app).getUserFields(), (data) => addActiveProject(plugin, data));
	try { const task = await service.importIssue(key); new Notice(`Imported ${typeof task.title === 'string' ? task.title : key.trim().toUpperCase()} from Jira.`); }
	catch (error) { const messages: Record<string, string> = { 'invalid-issue-key': 'Enter a Jira key such as PROJ-1234.', 'jira-unavailable': 'Enable and configure Jira Issue before importing.', 'tasknotes-unavailable': 'Enable a compatible TaskNotes version before importing.', 'fetch-failed': 'Jira Issue could not retrieve that issue.', 'creation-failed': 'TaskNotes could not create the imported task.' }; new Notice(error instanceof JiraImportError ? messages[error.code] ?? error.message : 'The Jira issue could not be imported.'); }
}
