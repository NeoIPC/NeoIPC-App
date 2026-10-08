import { act } from 'react'
import { AdminDhis2PublicBaseUrl, adminGetDhis2PublicBaseUrl } from '../api/admin'
import { renderHook } from '../test-utils/renderHook'
import { useDhis2PublicBaseUrl } from './useDhis2PublicBaseUrl'

jest.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ baseUrl: 'https://dhis.example' }),
}))

jest.mock('../api/admin', () => ({
    adminGetDhis2PublicBaseUrl: jest.fn(),
}))

const mockedGet = adminGetDhis2PublicBaseUrl as jest.MockedFunction<
    typeof adminGetDhis2PublicBaseUrl
>

/** Let the hook's fetch resolve and its state updates commit. */
const settle = (): Promise<void> =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
    })

describe('useDhis2PublicBaseUrl', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    // The endpoint is for administrators, so a form that asks for the address
    // of anyone else would provoke a refusal on every visit.
    it('asks nothing when the address is not wanted', async () => {
        const { result, unmount } = renderHook(() => useDhis2PublicBaseUrl(false))
        await settle()

        expect(mockedGet).not.toHaveBeenCalled()
        expect(result.current).toEqual({ address: null, error: null })
        unmount()
    })

    it('gives the address the service reports', async () => {
        const address: AdminDhis2PublicBaseUrl = {
            publicBaseUrl: 'https://dhis.example/',
            configured: true,
        }
        mockedGet.mockResolvedValue(address)

        const { result, unmount } = renderHook(() => useDhis2PublicBaseUrl(true))
        await settle()

        expect(mockedGet).toHaveBeenCalledWith('https://dhis.example')
        expect(result.current).toEqual({ address, error: null })
        unmount()
    })

    it('gives the error when the address cannot be fetched', async () => {
        const failure = new Error('404 Not Found')
        mockedGet.mockRejectedValue(failure)

        const { result, unmount } = renderHook(() => useDhis2PublicBaseUrl(true))
        await settle()

        expect(result.current).toEqual({ address: null, error: failure })
        unmount()
    })

    // The address stops being wanted while the request is out, as when the
    // form's user loses the administrator role; the late answer, address or
    // error, must not reappear.
    it.each(['resolves', 'rejects'] as const)(
        'drops the answer to a request no longer wanted when it %s',
        async (outcome) => {
            let answer!: () => void
            mockedGet.mockReturnValue(
                new Promise<AdminDhis2PublicBaseUrl>((resolve, reject) => {
                    answer = () =>
                        outcome === 'resolves'
                            ? resolve({ publicBaseUrl: 'https://dhis.example/', configured: true })
                            : reject(new Error('404 Not Found'))
                })
            )
            let enabled = true
            const { result, rerender, unmount } = renderHook(() =>
                useDhis2PublicBaseUrl(enabled)
            )

            enabled = false
            rerender()
            await act(async () => {
                answer()
            })
            await settle()

            expect(result.current).toEqual({ address: null, error: null })
            unmount()
        }
    )
})
