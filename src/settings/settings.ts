import { createDefaultJiraMappingSettings, normalizeJiraMappingSettings } from '../jira/JiraFieldMapping';
import type { JiraFieldMappingSettings } from '../jira/types';

export interface TaskNotesJiraSettings { version: 1; jiraMapping: JiraFieldMappingSettings; useActiveNoteAsProject: boolean }
export const DEFAULT_SETTINGS: TaskNotesJiraSettings = { version: 1, jiraMapping: createDefaultJiraMappingSettings(), useActiveNoteAsProject: false };
export function normalizeSettings(value: unknown): TaskNotesJiraSettings {
	const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
	return { version: 1, jiraMapping: normalizeJiraMappingSettings(record.jiraMapping), useActiveNoteAsProject: record.useActiveNoteAsProject === true };
}
