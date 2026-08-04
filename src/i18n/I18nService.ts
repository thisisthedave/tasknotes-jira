import type { I18nServiceOptions, InterpolationValues, TranslationResources, TranslationTree } from './types';

/** Flattens a nested translation tree into dot-delimited lookup keys. */
function flattenTranslations(tree: TranslationTree, prefix = ''): Record<string, string> {
	const entries: Record<string, string> = {};
	for (const [key, value] of Object.entries(tree)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'string') entries[fullKey] = value;
		else Object.assign(entries, flattenTranslations(value, fullKey));
	}
	return entries;
}

/** Replaces named `{token}` placeholders while preserving unknown placeholders. */
function interpolate(template: string, params?: InterpolationValues): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (_match, token: string) => Object.prototype.hasOwnProperty.call(params, token) ? String(params[token]) : `{${token}}`);
}

/** Reduces language-region codes to the language code used by bundled resources. */
function normalizeLocale(locale: string): string {
	return locale.toLowerCase().split('-')[0] ?? locale.toLowerCase();
}

/** Resolves localized UI strings with system-locale selection and English fallback. */
export class I18nService {
	private readonly resources: TranslationResources;
	private readonly defaultLocale: string;
	private readonly fallbackLocale: string;
	private readonly getSystemLocaleFn?: () => string;
	private readonly cache: Record<string, Record<string, string>> = {};
	private currentLocale: string;

	constructor(options: I18nServiceOptions) {
		this.resources = options.resources;
		this.defaultLocale = options.defaultLocale;
		this.fallbackLocale = options.fallbackLocale ?? 'en';
		this.getSystemLocaleFn = options.getSystemLocale;
		this.currentLocale = this.resolveLocale(options.initialLocale ?? options.defaultLocale);
	}

	/** Returns the active bundled locale code. */
	getCurrentLocale(): string { return this.currentLocale; }

	/** Changes the active locale, falling back when no matching resource exists. */
	setLocale(locale: string): void { this.currentLocale = this.resolveLocale(locale); }

	/** Resolves and interpolates a translation, returning the key when it is unknown. */
	translate(key: string, params?: InterpolationValues): string {
		return interpolate(this.resolveKey(key) ?? key, params);
	}

	/** Resolves a translation without interpolation, using the configured fallback chain. */
	resolveKey(key: string): string | undefined {
		for (const locale of [this.currentLocale, this.fallbackLocale, this.defaultLocale]) {
			const map = this.getLocaleMap(locale);
			if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
		}
		return undefined;
	}

	/** Reads the system locale provider, then the browser locale, then the default. */
	getSystemLocale(): string {
		const provided = this.getSystemLocaleFn?.();
		if (provided) return normalizeLocale(provided);
		if (typeof navigator !== 'undefined' && navigator.language) return normalizeLocale(navigator.language);
		return this.defaultLocale;
	}

	/** Returns and memoizes a flattened resource map for one locale. */
	private getLocaleMap(locale: string): Record<string, string> {
		const normalized = normalizeLocale(locale);
		if (!this.cache[normalized]) this.cache[normalized] = this.resources[normalized] ? flattenTranslations(this.resources[normalized]) : {};
		return this.cache[normalized];
	}

	/** Chooses an available locale for an explicit or system locale request. */
	private resolveLocale(locale: string): string {
		const requested = locale === 'system' ? this.getSystemLocale() : locale;
		const normalized = normalizeLocale(requested);
		if (this.resources[normalized]) return normalized;
		if (this.resources[this.defaultLocale]) return this.defaultLocale;
		return Object.keys(this.resources)[0] ?? this.fallbackLocale;
	}
}
