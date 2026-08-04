/** A nested tree whose leaves are localized strings. */
export interface TranslationTree {
	[key: string]: string | TranslationTree;
}

/** Locale codes mapped to their translation trees. */
export type TranslationResources = Record<string, TranslationTree>;

/** Values accepted by localized string interpolation. */
export type InterpolationValues = Record<string, string | number>;

/** Configuration used to construct the localization service. */
export interface I18nServiceOptions {
	resources: TranslationResources;
	defaultLocale: string;
	fallbackLocale?: string;
	initialLocale?: string;
	getSystemLocale?: () => string;
}
