import { languageSubtag, resolveReportLocale, withReportLocale } from './reportLocale'

describe('languageSubtag', () => {
    it.each([
        ['de', 'de'],
        ['de-DE', 'de'],
        ['pt_BR', 'pt'],
        ['uz-Cyrl-UZ', 'uz'],
        ['EN-gb', 'en'],
        ['', 'en'],
        [undefined, 'en'],
        [null, 'en'],
    ])('reads %p as %p', (tag, subtag) => {
        expect(languageSubtag(tag)).toBe(subtag)
    })
})

describe('resolveReportLocale', () => {
    it('sends a language the user picked as it is', () => {
        expect(resolveReportLocale('de', 'fr', ['de', 'en', 'fr'])).toBe('de')
    })

    it('uses the interface language when the report is available in it', () => {
        expect(resolveReportLocale('', 'de-AT', ['de', 'en'])).toBe('de')
    })

    it('uses English when the report is not available in the interface language', () => {
        expect(resolveReportLocale('', 'fr', ['de', 'en'])).toBe('en')
    })

    // With no language sent, the service negotiates one from the browser's
    // `Accept-Language`.
    it('sends no language for a blank field when the report languages failed to load', () => {
        expect(resolveReportLocale('', 'de', null)).toBe('')
    })

    it('sends a picked language when the report languages failed to load', () => {
        expect(resolveReportLocale('de', 'fr', null)).toBe('de')
    })

    it('uses English when the interface language is unknown', () => {
        expect(resolveReportLocale('', undefined, ['de', 'en'])).toBe('en')
    })
})

describe('withReportLocale', () => {
    it('resolves a blank language for a rendered report', () => {
        expect(withReportLocale({ locale: '', outputFormat: 'pdf' }, 'de', ['de', 'en'])).toEqual(
            { locale: 'de', outputFormat: 'pdf' }
        )
    })

    it('sends no language for a blank field when the report languages failed to load', () => {
        expect(withReportLocale({ locale: '', outputFormat: 'pdf' }, 'de', null)).toEqual({
            locale: '',
            outputFormat: 'pdf',
        })
    })

    it('sends no language with the JSON dataset for a blank field', () => {
        expect(withReportLocale({ locale: '', outputFormat: 'json' }, 'de', ['de', 'en'])).toEqual(
            { locale: '', outputFormat: 'json' }
        )
    })

    // The service checks a language sent with the dataset against the JSON
    // producer's own list, which a report language need not be on.
    it('sends no language with the JSON dataset for a picked one either', () => {
        expect(
            withReportLocale({ locale: 'es', outputFormat: 'json' }, 'de', ['de', 'en', 'es'])
        ).toEqual({ locale: '', outputFormat: 'json' })
    })
})
