export type JiraValueSourceMode = 'path' | 'template' | 'fixed' | 'off';

export interface JiraValueSource { mode: JiraValueSourceMode; value: string }
export interface JiraEnumRemap { taskValue: string; jiraValues: string[] }
export type JiraBuiltInFieldId = 'id' | 'title' | 'details' | 'status' | 'priority' | 'due' | 'scheduled' | 'timeEstimate' | 'dateCreated' | 'dateModified' | 'completedDate' | 'recurrence' | 'tags' | 'projects' | 'contexts';
export interface JiraFieldMappingSettings {
	version: 1;
	fields: Partial<Record<JiraBuiltInFieldId, JiraValueSource[]>>;
	userFields: Record<string, JiraValueSource[]>;
	enumRemaps: { status: JiraEnumRemap[]; priority: JiraEnumRemap[]; contexts: JiraEnumRemap[] };
}
export interface UserMappedField { id: string; displayName: string; key: string; type: 'text' | 'number' | 'date' | 'boolean' | 'list' }
export interface JiraIssue { key: string; fields: Record<string, unknown> & { summary: string } }
export interface TaskCreationData {
	creationContext?: string; id?: string; title: string; details?: string; status?: string; priority?: string;
	due?: string; scheduled?: string; timeEstimate?: number; dateCreated?: string; dateModified?: string;
	completedDate?: string; recurrence?: string; tags?: string[]; projects?: string[]; contexts?: string[];
	customFrontmatter?: Record<string, unknown>;
}
export interface TaskInfo { title?: string; path?: string; [key: string]: unknown }
