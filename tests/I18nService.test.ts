import { describe, expect, it } from 'vitest';
import { I18nService } from '../src/i18n/I18nService';
import { createI18nService } from '../src/i18n';

describe('I18nService', () => {
	it('uses the system locale and falls back to English when it is unavailable', () => {
		const service = createI18nService({ initialLocale: 'system', getSystemLocale: () => 'fr-CA' });
		expect(service.getCurrentLocale()).toBe('en');
		expect(service.translate('commands.importJiraIssue')).toBe('Import Jira issue as task');
	});

	it('resolves nested keys, interpolates parameters, and preserves unknown tokens', () => {
		const service = new I18nService({
			resources: { en: { notice: { imported: 'Imported {title} with {unknown}.' } } },
			defaultLocale: 'en',
		});
		expect(service.translate('notice.imported', { title: 'PROJ-1' })).toBe('Imported PROJ-1 with {unknown}.');
		expect(service.translate('missing.key')).toBe('missing.key');
	});
});
