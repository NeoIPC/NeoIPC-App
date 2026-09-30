import i18n from '@dhis2/d2-i18n'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { useAppContext } from '../AppContext'
import { useAuthorities } from '../authority/useAuthorities'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import PartnerReportForm, { PartnerReportFormValues } from './PartnerReportForm'
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

describe('PartnerReportForm', () => {
    const initialLanguage = i18n.language
    let host: HTMLDivElement
    let root: Root
    let onSubmit: jest.Mock<void, [PartnerReportFormValues]>

    beforeEach(() => {
        onSubmit = jest.fn()
        mockedUseAuthorities.mockReturnValue({ has: () => true, isAdmin: false })
        mockedUseAppContext.mockReturnValue({
            me: { id: 'u1', authorities: ['F_NEOIPC_REPORT'] },
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

    /** Render the form with a department picked, which a submission needs. */
    const renderWithDepartment = (): void => {
        act(() => root.render(<PartnerReportForm onSubmit={onSubmit} />))
        const picker = mockedPicker.mock.calls
            .map(([props]) => props)
            .find((props) => props.name === 'unitCodes')
        act(() => picker.onChange(['AT_TEST_TEST']))
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
            renderWithDepartment()

            submit()

            expect(onSubmit).toHaveBeenCalledTimes(1)
            expect(onSubmit.mock.calls[0][0].locale).toBe(sent)
        }
    )

    it('sends no language with the JSON dataset download', () => {
        i18n.language = 'de-DE'
        renderWithDepartment()
        act(() => {
            host.querySelector<HTMLInputElement>('input[name="outputFormat"][value="json"]')?.click()
        })

        submit()

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ outputFormat: 'json', locale: '' })
    })

    it('shows Generate as loading, and does not generate, until the report languages load', () => {
        i18n.language = 'de-DE'
        withLocales(null)
        renderWithDepartment()

        expect(generateButton().disabled).toBe(true)
        expect(generateButton().querySelector('[role="progressbar"]')).not.toBeNull()
        act(() => generateButton().click())
        expect(onSubmit).not.toHaveBeenCalled()

        withLocales(['de', 'en'])
        act(() => root.render(<PartnerReportForm onSubmit={onSubmit} />))

        expect(generateButton().disabled).toBe(false)
        act(() => generateButton().click())
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('de')
    })

    it('sends no language for a blank report language when the report languages failed to load', () => {
        i18n.language = 'de-DE'
        withLocales(null, new Error('502 Bad Gateway'))
        renderWithDepartment()

        expect(generateButton().disabled).toBe(false)
        act(() => generateButton().click())

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('')
    })
})
