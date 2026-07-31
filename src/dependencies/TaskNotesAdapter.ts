import type { App } from 'obsidian';
import type { TaskCreationData, TaskInfo, UserMappedField } from '../jira/types';

export const TASKNOTES_PLUGIN_ID = 'tasknotes';
export class TaskNotesAdapterError extends Error { constructor(public readonly code: 'dependency-unavailable' | 'creation-failed', message: string, public readonly cause?: unknown) { super(message); this.name = 'TaskNotesAdapterError'; } }
interface TaskNotesApi {
	apiVersion: number; capabilities: readonly string[]; hasCapability?(capability: string): boolean;
	createTask(data: TaskCreationData, context?: { source?: string }): Promise<TaskInfo>;
	catalog?: { userFields?(): unknown };
}
function getApi(plugin: unknown): TaskNotesApi | null {
	if (!plugin || typeof plugin !== 'object') return null; const api: unknown = Reflect.get(plugin, 'api');
	if (!api || typeof api !== 'object' || Reflect.get(api, 'apiVersion') !== 1 || typeof Reflect.get(api, 'createTask') !== 'function') return null;
	const capabilities: unknown = Reflect.get(api, 'capabilities');
	if (!Array.isArray(capabilities) || !capabilities.includes('tasks.write')) return null;
	return api as TaskNotesApi;
}
function isUserField(value: unknown): value is UserMappedField {
	if (!value || typeof value !== 'object') return false;
	return ['id', 'displayName', 'key', 'type'].every((key) => typeof Reflect.get(value, key) === 'string') && ['text', 'number', 'date', 'boolean', 'list'].includes(String(Reflect.get(value, 'type')));
}
export class TaskNotesAdapter {
	constructor(private readonly getPlugin: () => unknown) {}
	static fromApp(app: App): TaskNotesAdapter { return new TaskNotesAdapter(() => (app as App & { plugins: { getPlugin(id: string): unknown } }).plugins.getPlugin(TASKNOTES_PLUGIN_ID)); }
	isAvailable(): boolean { return getApi(this.getPlugin()) !== null; }
	getUserFields(): UserMappedField[] { const api = getApi(this.getPlugin()); if (!api) return []; const value = api.catalog?.userFields?.(); return Array.isArray(value) ? value.filter(isUserField) : []; }
	async createTask(data: TaskCreationData): Promise<TaskInfo> {
		const api = getApi(this.getPlugin()); if (!api) throw new TaskNotesAdapterError('dependency-unavailable', 'TaskNotes v1 API with task creation is unavailable.');
		try { return await api.createTask(data, { source: 'tasknotes-jira' }); }
		catch (error) { throw new TaskNotesAdapterError('creation-failed', 'TaskNotes could not create the imported task.', error); }
	}
}
