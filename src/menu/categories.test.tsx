import { useAppContext } from '../AppContext'
import { useAuthorities } from '../authority/useAuthorities'
import { renderHook } from '../test-utils/renderHook'
import { visibleCategories } from './categories'

jest.mock('../AppContext', () => ({
    useAppContext: jest.fn(),
}))

const mockedUseAppContext = useAppContext as jest.MockedFunction<
    typeof useAppContext
>

const withAuthorities = (authorities: string[]): void => {
    mockedUseAppContext.mockReturnValue({
        me: { id: 'u1', authorities },
        referenceDataSets: [],
        reloadReferenceDataSets: jest.fn().mockResolvedValue(undefined),
    })
}

/**
 * The authority profiles behind the play test users, and the left-nav + admin
 * gating each should get. Pins the behaviour per persona at the logic level
 * (nav filtering + `isAdmin`) with no browser — the irreducible render / CRUD /
 * session paths stay in the Playwright suite.
 */
const PROFILES = [
    {
        name: 'superuser — admin / play.admin (ALL)',
        authorities: ['ALL'],
        nav: [
            'reports/partner',
            'reports/reference',
            'reports/validation',
            'admin/reference-data',
            'admin/validation-exceptions',
        ],
        isAdmin: true,
    },
    {
        name: 'report-only — play.at.report1 / play.ch.report1 (ReportViewer)',
        authorities: [
            'F_NEOIPC_REPORT',
            'F_EXPORT_DATA',
            'F_METADATA_EXPORT',
            'F_VIEW_EVENT_ANALYTICS',
        ],
        nav: ['reports/partner', 'reports/reference', 'reports/validation'],
        isAdmin: false,
    },
    {
        name: 'report + admin — play.at.admin1 (ReportViewer + NeoIPC Admin)',
        authorities: ['F_NEOIPC_REPORT', 'F_NEOIPC_ADMIN'],
        nav: [
            'reports/partner',
            'reports/reference',
            'reports/validation',
            'admin/reference-data',
            'admin/validation-exceptions',
        ],
        isAdmin: true,
    },
    {
        name: 'admin-only — play.at.adminonly1 (NeoIPC Admin, no report)',
        authorities: ['F_NEOIPC_ADMIN'],
        nav: ['admin/reference-data', 'admin/validation-exceptions'],
        isAdmin: true,
    },
    {
        name: 'no NeoIPC authorities — data users',
        authorities: ['M_dhis-web-dashboard'],
        nav: [],
        isAdmin: false,
    },
]

describe('authority behaviour per play persona', () => {
    afterEach(() => jest.clearAllMocks())

    PROFILES.forEach((profile) => {
        it(`${profile.name}: nav items + isAdmin`, () => {
            withAuthorities(profile.authorities)
            const { result } = renderHook(() => useAuthorities())

            expect(result.current.isAdmin).toBe(profile.isAdmin)
            expect(
                visibleCategories(result.current.has).map((c) => c.id)
            ).toEqual(profile.nav)
        })
    })
})
