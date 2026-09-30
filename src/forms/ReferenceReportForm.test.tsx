import i18n from '@dhis2/d2-i18n'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { useAppContext } from '../AppContext'
import { useAuthorities } from '../authority/useAuthorities'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import ReferenceReportForm, { ReferenceReportFormValues } from './ReferenceReportForm'
import { useReportConfig } from './useReportConfig'

// The form's data comes through these hooks and the pickers; what is under
// test is what the form does with it.
jest.mock('../AppContext', () => ({ useAppContext: jest.fn() }))
jest.mock('../authority/useAuthorities', () => ({ useAuthorities: jest.fn() }))
jest.mock('./useReportConfig', () => ({ useReportConfig: jest.fn() }))
jest.mock('./fields/useOrgUnitNames', () => ({ useOrgUnitNames: () => ({}) }))
jest.mock('./fields/OrganisationUnitMultiSelect', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const mockedUseAppContext = useAppContext as jest.MockedFunction<typeof useAppContext>
const mockedUseAuthorities = useAuthorities as jest.MockedFunction<typeof useAuthorities>
const mockedUseReportConfig = useReportConfig as jest.MockedFunction<typeof useReportConfig>
const mockedPicker = OrganisationUnitMultiSelect as unknown as jest.Mock

describe('ReferenceReportForm', () => {
    const initialLanguage = i18n.language
    let host: HTMLDivElement
    let root: Root
    let onSubmit: jest.Mock<void, [ReferenceReportFormValues]>

    beforeEach(() => {
        onSubmit = jest.fn()
        // An administrator may render from live filters, so the form can be
        // submitted without a stored dataset.
        mockedUseAuthorities.mockReturnValue({ has: () => true, isAdmin: true })
        mockedUseAppContext.mockReturnValue({
            me: { id: 'u1', authorities: ['ALL'] },
            referenceDataSets: [],
            reloadReferenceDataSets: jest.fn().mockResolvedValue(undefined),
        })
        mockedUseReportConfig.mockReturnValue({ presets: {}, locales: ['de', 'en'], error: null })
        host = document.createElement('div')
        document.body.appendChild(host)
        root = createRoot(host)
    })

    afterEach(() => {
        act(() => root.unmount())
        host.remove()
        i18n.language = initialLanguage
        jest.clearAllMocks()
    })

    const render = (): void => {
        act(() => root.render(<ReferenceReportForm onSubmit={onSubmit} />))
    }

    const submit = (): void => {
        act(() => host.querySelector('form')?.requestSubmit())
    }

    it.each([
        ['de-DE', 'de'],
        ['fr', 'en'],
    ])(
        'sends %p as %p for a blank report language',
        (interfaceLanguage, sent) => {
            i18n.language = interfaceLanguage
            render()

            submit()

            expect(onSubmit).toHaveBeenCalledTimes(1)
            expect(onSubmit.mock.calls[0][0].locale).toBe(sent)
        }
    )

    // Departments of the same name in two hospitals are told apart only by
    // the hospital the label names.
    it('names each department with its hospital in the department filter', () => {
        render()
        act(() => {
            host.querySelector<HTMLButtonElement>('button[aria-expanded]')?.click()
        })

        const departmentFilter = mockedPicker.mock.calls
            .map(([props]) => props)
            .find((props) => props.name === 'departmentFilter')
        expect(departmentFilter).toMatchObject({ showParentInLabel: true })
    })
})
