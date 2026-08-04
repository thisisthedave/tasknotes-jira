import { I18nService } from './I18nService';
import { en } from './resources/en';
import type { I18nServiceOptions, InterpolationValues, TranslationResources } from './types';

export const translationResources = { en } satisfies TranslationResources;
export type { InterpolationValues };

/** Creates the plugin localization service with the TaskNotes fallback contract. */
export function createI18nService(options?: Partial<I18nServiceOptions>): I18nService {
	return new I18nService({ resources: translationResources, defaultLocale: 'en', fallbackLocale: 'en', ...options });
}

export { I18nService };
