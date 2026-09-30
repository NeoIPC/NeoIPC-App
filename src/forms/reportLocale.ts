/**
 * The base language subtag of a language tag, lower-cased: `de` for
 * `de-DE`, `pt` for `pt_BR`. A missing or empty tag gives `en`. The app
 * platform writes the interface language as a BCP 47 tag, while DHIS2
 * writes its own locales with an underscore, so both separators count.
 */
export const languageSubtag = (tag: string | null | undefined): string =>
    (tag ?? '').split(/[-_]/)[0].toLowerCase() || 'en'

/**
 * The `locale` a report request carries. A language the user picked is
 * sent as it is. With the field blank, it is the base subtag of
 * `interfaceLanguage` (the app's `i18n.language`, which the app platform
 * takes from the DHIS2 interface language) when the report's locale list
 * `available` contains it, and English otherwise, including while that
 * list has not loaded or failed to load.
 */
export const resolveReportLocale = (
    chosen: string,
    interfaceLanguage: string | null | undefined,
    available: readonly string[] | null
): string => {
    if (chosen !== '') return chosen
    const subtag = languageSubtag(interfaceLanguage)
    return (available ?? []).some((tag) => tag.toLowerCase() === subtag) ? subtag : 'en'
}

/**
 * The form values a report form submits, with the report language
 * resolved by {@link resolveReportLocale}. The Partner Report's JSON
 * dataset is left as it is: it carries codes rather than text, and the
 * service checks a language sent with it against that producer's own list
 * rather than the report's, so a language sent for it adds nothing and can
 * turn a download into a refusal.
 */
export const withReportLocale = <T extends { locale: string; outputFormat: string }>(
    values: T,
    interfaceLanguage: string | null | undefined,
    available: readonly string[] | null
): T =>
    values.outputFormat === 'json'
        ? values
        : { ...values, locale: resolveReportLocale(values.locale, interfaceLanguage, available) }
