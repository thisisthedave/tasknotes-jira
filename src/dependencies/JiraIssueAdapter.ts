import type { App } from 'obsidian';
import type { JiraIssue } from '../jira/types';

export const JIRA_PLUGIN_ID = 'obsidian-jira-issue';
export type JiraIssueAdapterErrorCode = 'invalid-issue-key' | 'dependency-unavailable' | 'fetch-failed' | 'invalid-response';
export class JiraIssueAdapterError extends Error {
	constructor(public readonly code: JiraIssueAdapterErrorCode, message: string, public readonly cause?: unknown) { super(message); this.name = 'JiraIssueAdapterError'; }
}
interface JiraPlugin { api: { base: { getIssue(key: string): Promise<unknown> } } }
function isJiraPlugin(value: unknown): value is JiraPlugin {
	if (!value || typeof value !== 'object') return false;
	const api: unknown = Reflect.get(value, 'api'); const base: unknown = api && typeof api === 'object' ? Reflect.get(api, 'base') : null;
	return !!base && typeof base === 'object' && typeof Reflect.get(base, 'getIssue') === 'function';
}
function parseIssue(value: unknown): JiraIssue {
	if (!value || typeof value !== 'object') throw new JiraIssueAdapterError('invalid-response', 'Jira returned an invalid issue.');
	const key: unknown = Reflect.get(value, 'key'); const fields: unknown = Reflect.get(value, 'fields');
	const summary: unknown = fields && typeof fields === 'object' ? Reflect.get(fields, 'summary') : undefined;
	if (typeof key !== 'string' || !key.trim() || !fields || typeof fields !== 'object' || Array.isArray(fields) || typeof summary !== 'string' || !summary.trim()) {
		throw new JiraIssueAdapterError('invalid-response', 'Jira returned an issue without a key, fields, or summary.');
	}
	return value as JiraIssue;
}
export function normalizeJiraIssueKey(value: string): string {
	const key = value.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key)) throw new JiraIssueAdapterError('invalid-issue-key', `Invalid Jira issue key: ${value}`);
	return key;
}
export class JiraIssueAdapter {
	constructor(private readonly getPlugin: () => unknown) {}
	static fromApp(app: App): JiraIssueAdapter { return new JiraIssueAdapter(() => (app as App & { plugins: { getPlugin(id: string): unknown } }).plugins.getPlugin(JIRA_PLUGIN_ID)); }
	isAvailable(): boolean { return isJiraPlugin(this.getPlugin()); }
	async getIssue(value: string): Promise<JiraIssue> {
		const key = normalizeJiraIssueKey(value); const plugin = this.getPlugin();
		if (!isJiraPlugin(plugin)) throw new JiraIssueAdapterError('dependency-unavailable', 'Jira Issue is missing or exposes an incompatible API.');
		try { return parseIssue(await plugin.api.base.getIssue(key)); }
		catch (error) { if (error instanceof JiraIssueAdapterError) throw error; throw new JiraIssueAdapterError('fetch-failed', `Failed to fetch Jira issue ${key}.`, error); }
	}
}
