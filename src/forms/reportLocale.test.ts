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

    it('uses English while the report languages have not loaded', () => {
        expect(resolveReportLocale('', 'de', null)).toBe('en')
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

    it('leaves the language of the JSON dataset as it is', () => {
        expect(withReportLocale({ locale: '', outputFormat: 'json' }, 'de', ['de', 'en'])).toEqual(
            { locale: '', outputFormat: 'json' }
        )
    })
})
