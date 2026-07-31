import { JiraIssueAdapter, JiraIssueAdapterError } from '../dependencies/JiraIssueAdapter';
import { TaskNotesAdapter, TaskNotesAdapterError } from '../dependencies/TaskNotesAdapter';
import { mapJiraIssueWithSettings } from './JiraFieldMapping';
import type { JiraFieldMappingSettings, TaskCreationData, TaskInfo, UserMappedField } from './types';

export type JiraImportErrorCode = 'invalid-issue-key' | 'jira-unavailable' | 'tasknotes-unavailable' | 'fetch-failed' | 'creation-failed';
export class JiraImportError extends Error { constructor(public readonly code: JiraImportErrorCode, message: string, public readonly cause?: unknown) { super(message); this.name = 'JiraImportError'; } }
export class JiraImportService {
	constructor(private jira: JiraIssueAdapter, private taskNotes: TaskNotesAdapter, private settings: JiraFieldMappingSettings, private userFields: readonly UserMappedField[], private prepare: (data: TaskCreationData) => TaskCreationData = (data) => data) {}
	async importIssue(key: string): Promise<TaskInfo> {
		let issue;
		try { issue = await this.jira.getIssue(key); }
		catch (error) { if (error instanceof JiraIssueAdapterError) throw new JiraImportError(error.code === 'invalid-issue-key' ? 'invalid-issue-key' : error.code === 'dependency-unavailable' ? 'jira-unavailable' : 'fetch-failed', error.message, error); throw new JiraImportError('fetch-failed', 'Failed to fetch the Jira issue.', error); }
		try { return await this.taskNotes.createTask(this.prepare(mapJiraIssueWithSettings(issue, this.settings, this.userFields))); }
		catch (error) { if (error instanceof TaskNotesAdapterError && error.code === 'dependency-unavailable') throw new JiraImportError('tasknotes-unavailable', error.message, error); throw new JiraImportError('creation-failed', `Failed to create a task for ${issue.key}.`, error); }
	}
}
