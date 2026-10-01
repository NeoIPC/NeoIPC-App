import i18n from '@dhis2/d2-i18n'
import { act } from 'react'
import { loadValidationRules, ValidationRule } from '../api/reportConfig'
import { renderHook } from '../test-utils/renderHook'
import { useValidationRules } from './useValidationRules'

jest.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ baseUrl: 'https://dhis.example' }),
}))

jest.mock('../api/reportConfig', () => ({
    loadValidationRules: jest.fn(),
}))

const mockedLoad = loadValidationRules as jest.MockedFunction<typeof loadValidationRules>

/** Let the hook's fetch resolve and its state updates commit. */
const settle = (): Promise<void> =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
    })

/** A promise the test settles when it chooses, to order two responses. */
const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
    let resolve: (value: T) => void = () => undefined
    const promise = new Promise<T>((settleWith) => {
        resolve = settleWith
    })
    return { promise, resolve }
}

describe('useValidationRules', () => {
    const initialLanguage = i18n.language

    afterEach(() => {
        i18n.language = initialLanguage
        jest.clearAllMocks()
    })

    // The service's rule summaries are keyed by the bare language, while the
    // interface language arrives as a full tag in either separator's form.
    it.each([
        ['de-DE', 'de'],
        ['pt_BR', 'pt'],
    ])('asks for the summaries of %p by the base subtag %p', async (tag, subtag) => {
        i18n.language = tag
        mockedLoad.mockResolvedValue([])

        const { unmount } = renderHook(() => useValidationRules())
        await settle()

        expect(mockedLoad).toHaveBeenCalledWith('https://dhis.example', subtag)
        unmount()
    })

    // React 18 ignores a state update on an unmounted component without a
    // warning, so what the guard against a superseded request changes is
    // visible only while the hook stays mounted: a request made for an
    // earlier interface language must not overwrite the current one's rules.
    it('keeps the current language\'s rules when an earlier request answers last', async () => {
        const german = deferred<ValidationRule[]>()
        const french = deferred<ValidationRule[]>()
        mockedLoad.mockReturnValueOnce(german.promise).mockReturnValueOnce(french.promise)

        i18n.language = 'de'
        const { result, rerender, unmount } = renderHook(() => useValidationRules())
        i18n.language = 'fr'
        rerender()
        expect(mockedLoad.mock.calls.map(([, language]) => language)).toEqual(['de', 'fr'])

        const frenchRules = [{ id: 1, summary: 'Règle française' }]
        french.resolve(frenchRules)
        await settle()
        german.resolve([{ id: 1, summary: 'Deutsche Regel' }])
        await settle()

        expect(result.current).toEqual({ rules: frenchRules, error: null })
        unmount()
    })

    it('keeps the current language\'s rules when an earlier request fails last', async () => {
        let failGerman: (reason: Error) => void = () => undefined
        const germanFailure = new Promise<ValidationRule[]>((_, reject) => {
            failGerman = reject
        })
        const french = deferred<ValidationRule[]>()
        mockedLoad.mockReturnValueOnce(germanFailure).mockReturnValueOnce(french.promise)

        i18n.language = 'de'
        const { result, rerender, unmount } = renderHook(() => useValidationRules())
        i18n.language = 'fr'
        rerender()

        const frenchRules = [{ id: 1, summary: 'Règle française' }]
        french.resolve(frenchRules)
        await settle()
        failGerman(new Error('the superseded request failed'))
        await settle()

        expect(result.current).toEqual({ rules: frenchRules, error: null })
        unmount()
    })
})
