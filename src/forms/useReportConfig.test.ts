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
        // A report without presets has no presets endpoint: asking for them
        // fails, and the failure takes the locales, and so the language
        // picker, down with it.
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
            error: null,
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
        expect(result.current).toEqual({ presets, locales: ['en'], error: null })
        unmount()
    })
})
