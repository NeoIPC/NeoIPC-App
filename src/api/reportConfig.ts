import { fetchNeoipcReporting, NeoipcReportingError } from './neoipcReporting'

/**
 * The report URL segments the config endpoints are mounted under
 * (`/<report>/presets`, `/<report>/locales`). The Validation Report has no
 * presets.
 */
export type ReportSegment = 'partner-report' | 'reference-report' | 'validation-report'

/** One validation rule: its id and a one-sentence summary of what it checks. */
export interface ValidationRule {
    id: number
    summary: string
}

/**
 * Fetch the Validation Report's rule catalogue from
 * `GET /validation-report/rules?locale=`, the summaries in `language` where
 * the report carries that translation and in English otherwise. The service
 * reads the catalogue from the report's own string resources, so a rule the
 * report gains appears here without an app release. A language the report
 * does not serve at all is refused with a 400, and the list is then asked
 * for in English.
 */
export const loadValidationRules = async (
    baseUrl: string,
    language: string
): Promise<ValidationRule[]> => {
    const fetchRules = async (lang: string): Promise<ValidationRule[]> => {
        const response = await fetchNeoipcReporting(
            baseUrl,
            `/validation-report/rules?locale=${encodeURIComponent(lang)}`
        )
        const body = (await response.json()) as { rules: ValidationRule[] }
        return body.rules
    }
    if (language === '' || language === 'en') return fetchRules('en')
    try {
        return await fetchRules(language)
    } catch (err) {
        if (err instanceof NeoipcReportingError && err.response.status === 400) {
            return fetchRules('en')
        }
        throw err
    }
}

/**
 * A preset's content overrides: a map of param name → value. Values are
 * the `includeX` figure/table booleans, the two `includeXTexts`
 * booleans, and the confidence-interval token (under the QMD param key
 * `includeConfidenceIntervals`). Each preset lists **only** the params
 * that differ from the QMD defaults — the effective set is
 * `defaults ⊕ overrides`.
 */
export type PresetOverrides = Record<string, boolean | string>

/** Named presets: preset name → its {@link PresetOverrides}. */
export type PresetMap = Record<string, PresetOverrides>

/**
 * Fetch a report's content presets from `GET /<report>/presets`. The
 * backend reads these at runtime from the Surveillance-Toolkit's
 * `presets.json`, so they change with the report without an app release.
 */
export const loadPresets = async (
    baseUrl: string,
    report: ReportSegment
): Promise<PresetMap> => {
    const response = await fetchNeoipcReporting(baseUrl, `/${report}/presets`)
    return (await response.json()) as PresetMap
}

/**
 * Fetch a report's supported locale tags from `GET /<report>/locales`
 * (the language codes for which a `{Report}.<lang>.qmd` wrapper exists).
 * The app renders human-readable language names client-side; the wire
 * value stays the tag.
 */
export const loadLocales = async (
    baseUrl: string,
    report: ReportSegment
): Promise<string[]> => {
    const response = await fetchNeoipcReporting(baseUrl, `/${report}/locales`)
    return (await response.json()) as string[]
}
