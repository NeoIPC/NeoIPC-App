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
        mockedUseReportConfig.mockReturnValue({
            presets: {},
            locales: ['de', 'en'],
            presetsError: null,
            localesError: null,
        })
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

    const generateButton = (): HTMLButtonElement => {
        const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')
        if (!button) throw new Error('no Generate button on the page')
        return button
    }

    const withLocales = (locales: string[] | null, localesError: Error | null = null): void => {
        mockedUseReportConfig.mockReturnValue({
            presets: {},
            locales,
            presetsError: null,
            localesError,
        })
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

    it('shows Generate as loading, and does not generate, until the report languages load', () => {
        i18n.language = 'de-DE'
        withLocales(null)
        render()

        expect(generateButton().disabled).toBe(true)
        expect(generateButton().querySelector('[role="progressbar"]')).not.toBeNull()
        act(() => generateButton().click())
        expect(onSubmit).not.toHaveBeenCalled()

        withLocales(['de', 'en'])
        render()

        expect(generateButton().disabled).toBe(false)
        act(() => generateButton().click())
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('de')
    })

    it('sends no language for a blank report language when the report languages failed to load', () => {
        i18n.language = 'de-DE'
        withLocales(null, new Error('502 Bad Gateway'))
        render()

        expect(generateButton().disabled).toBe(false)
        act(() => generateButton().click())

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('')
    })

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
