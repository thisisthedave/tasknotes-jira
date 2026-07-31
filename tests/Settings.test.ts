import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settings/settings';
import { parseJiraEnumRemaps, serializeJiraIssuePreview } from '../src/settings/previewUtils';
describe('settings helpers', () => {
	it('never includes ephemeral sample data in persisted settings', () => { expect(normalizeSettings({ sampleKey: 'SECRET-1', sampleIssue: { secret: true } })).not.toHaveProperty('sampleKey'); });
	it('parses remaps and truncates displayed JSON', () => { expect(parseJiraEnumRemaps('done = Closed, Resolved')).toEqual([{ taskValue: 'done', jiraValues: ['Closed', 'Resolved'] }]); const result = serializeJiraIssuePreview({ key: 'A-1', fields: { summary: 'Long', secret: 'abcdef' } }, 10); expect(result.truncated).toBe(true); expect(result.text.length).toBeLessThan(20); });
});
