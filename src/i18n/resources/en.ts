import type { TranslationTree } from '../types';

/** English source strings and fallback resource for every localized plugin surface. */
export const en: TranslationTree = {
	common: { loading: 'Loading…', fetch: 'Fetch', addSource: 'Add source', removeSource: 'Remove source' },
	commands: { importJiraIssue: 'Import Jira issue as task' },
	startup: {
		tasknotesUnavailable: 'TaskNotes Jira: enable a compatible TaskNotes version to import issues.',
		jiraUnavailable: 'TaskNotes Jira: enable and configure Jira Issue to import issues.',
	},
	import: {
		modalTitle: 'Import Jira issue as task', issueKey: 'Jira issue key', issueKeyPlaceholder: 'PROJ-1234', action: 'Import',
		success: 'Imported {title} from Jira.',
		errors: {
			invalidIssueKey: 'Enter a Jira key such as PROJ-1234.', jiraUnavailable: 'Enable and configure Jira Issue before importing.',
			tasknotesUnavailable: 'Enable a compatible TaskNotes version before importing.', fetchFailed: 'Jira Issue could not retrieve that issue.',
			creationFailed: 'TaskNotes could not create the imported task.', unknown: 'The Jira issue could not be imported.',
		},
	},
	settings: {
		title: 'TaskNotes Jira', description: 'Map Jira issue data to TaskNotes fields. Sample keys and payloads remain in memory only.',
		activeProject: { name: 'Use active note as project', description: 'When Jira does not map a project, add the active note as a wiki-link project.' },
		sample: {
			name: 'Sample issue', description: 'Fetch explicitly to preview the current mapping.', declarativeDescription: 'Fetch explicitly to preview the current mapping. Sample keys and payloads remain in memory only.',
			errorName: 'Sample issue error', fetchError: 'Could not fetch the sample issue.',
		},
		fieldSources: { heading: 'Field sources', description: 'Paths read Jira JSON. Templates interpolate $key and $fields.* tokens. List fields can merge sources.', resetName: 'Reset mappings', resetDescription: 'Restore the default Jira-to-TaskNotes field sources.', resetButton: 'Reset mappings', none: 'No sources configured.', source: '{label} source {number}', add: 'Add {label} source' },
		userFields: 'User-defined fields',
		valueRemapping: { heading: 'Value remapping', description: 'One per line: TaskNotes value = Jira value, alternate Jira value.' },
		modes: { path: 'Jira path', template: 'Template', fixed: 'Fixed value', off: 'Disabled' },
		placeholders: { template: '$key $fields.summary', path: 'fields.summary' },
		preview: {
			resolved: 'Resolved values', alias: 'Jira preview', missing: 'Missing', invalid: 'Invalid', raw: 'Raw Jira JSON',
			rawDescription: 'Collapsed by default. The on-screen payload is capped; copy uses the complete payload.', copyAria: 'Copy raw JSON',
			copied: 'Copied Jira JSON.', copyFailed: 'Could not copy Jira JSON.', truncated: 'Preview truncated.',
		},
		fields: { id: 'ID', title: 'Title', details: 'Details', status: 'Status', priority: 'Priority', due: 'Due', scheduled: 'Scheduled', timeEstimate: 'Time estimate', dateCreated: 'Date created', dateModified: 'Date modified', completedDate: 'Completed date', recurrence: 'Recurrence', tags: 'Tags', projects: 'Projects', contexts: 'Contexts' },
	},
};
