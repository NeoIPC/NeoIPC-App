import { act } from 'react'
import { loadLocales, loadPresets } from '../api/reportConfig'
import { renderHook } from '../test-utils/renderHook'
import { useReportConfig } from './useReportConfig'

jest.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ baseUrl: 'https://dhis.example' }),
}))

jest.mock('../api/reportConfig', () => ({
    loadPresets: jest.fn(),
    loadLocales: jest.fn(),
}))

const mockedLoadPresets = loadPresets as jest.MockedFunction<typeof loadPresets>
const mockedLoadLocales = loadLocales as jest.MockedFunction<typeof loadLocales>

/** Let the hook's fetches resolve and their state updates commit. */
const settle = (): Promise<void> =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
    })

describe('useReportConfig', () => {
    afterEach(() => jest.clearAllMocks())

    it('with presets: false, fetches only the locales and still delivers them', async () => {
        // A report without presets has no presets endpoint, so asking for
        // them could only fail.
        mockedLoadPresets.mockRejectedValue(new Error('404 Not Found'))
        mockedLoadLocales.mockResolvedValue(['de', 'en'])

        const { result, unmount } = renderHook(() =>
            useReportConfig('validation-report', { presets: false })
        )
        await settle()

        expect(mockedLoadPresets).not.toHaveBeenCalled()
        expect(mockedLoadLocales).toHaveBeenCalledWith(
            'https://dhis.example',
            'validation-report'
        )
        expect(result.current).toEqual({
            presets: null,
            locales: ['de', 'en'],
            presetsError: null,
            localesError: null,
        })
        unmount()
    })

    it('fetches the presets as well by default', async () => {
        const presets = { Short: { includeFigures: false } }
        mockedLoadPresets.mockResolvedValue(presets)
        mockedLoadLocales.mockResolvedValue(['en'])

        const { result, unmount } = renderHook(() => useReportConfig('partner-report'))
        await settle()

        expect(mockedLoadPresets).toHaveBeenCalledWith(
            'https://dhis.example',
            'partner-report'
        )
        expect(result.current).toEqual({
            presets,
            locales: ['en'],
            presetsError: null,
            localesError: null,
        })
        unmount()
    })

    // The locale list decides the language a blank report language resolves
    // to; a presets failure must not take it down.
    it('keeps the locales when the presets fail to load', async () => {
        const failure = new Error('Malformed presets')
        mockedLoadPresets.mockRejectedValue(failure)
        mockedLoadLocales.mockResolvedValue(['de', 'en'])

        const { result, unmount } = renderHook(() => useReportConfig('partner-report'))
        await settle()

        expect(result.current).toEqual({
            presets: null,
            locales: ['de', 'en'],
            presetsError: failure,
            localesError: null,
        })
        unmount()
    })

    it('reports a locale list that failed to load as failed, not as loading', async () => {
        const failure = new Error('502 Bad Gateway')
        mockedLoadPresets.mockResolvedValue({})
        mockedLoadLocales.mockRejectedValue(failure)

        const { result, unmount } = renderHook(() => useReportConfig('partner-report'))
        await settle()

        expect(result.current).toEqual({
            presets: {},
            locales: null,
            presetsError: null,
            localesError: failure,
        })
        unmount()
    })
})
