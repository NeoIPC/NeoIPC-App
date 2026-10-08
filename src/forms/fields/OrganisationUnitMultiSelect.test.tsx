import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import OrganisationUnitMultiSelect from './OrganisationUnitMultiSelect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// One engine for every render: the picker fetches again whenever the engine
// it is given changes.
const mockEngine = { query: jest.fn() }
jest.mock('@dhis2/app-runtime', () => ({ useDataEngine: () => mockEngine }))

describe('OrganisationUnitMultiSelect', () => {
    let host: HTMLDivElement
    let root: Root

    beforeEach(() => {
        host = document.createElement('div')
        document.body.appendChild(host)
        root = createRoot(host)
    })

    afterEach(() => {
        act(() => root.unmount())
        host.remove()
        jest.clearAllMocks()
    })

    // The data engine's message reaches the user as written: neither as the
    // HTML entities i18next's escaping makes of slashes and quotation marks,
    // nor read again by i18next for placeholders and nesting.
    it('shows why the organisation units could not be loaded, as the engine words it', async () => {
        const message = 'Request to /api/organisationUnits failed: "{{count}}" $t(Clear)'
        mockEngine.query.mockRejectedValue(new Error(message))

        await act(async () => {
            root.render(
                <OrganisationUnitMultiSelect
                    name="departments"
                    label="Departments"
                    groupCode="NEO_DEPARTMENT"
                    selectedCodes={[]}
                    onChange={() => undefined}
                />
            )
        })
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })

        expect(host.textContent).toContain(`Failed to load organisation units — ${message}`)
    })
})
