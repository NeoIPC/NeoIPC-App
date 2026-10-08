import i18n from '@dhis2/d2-i18n'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { useAuthorities } from '../authority/useAuthorities'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import { Dhis2PublicBaseUrlState, useDhis2PublicBaseUrl } from './useDhis2PublicBaseUrl'
import { useReportConfig } from './useReportConfig'
import { useValidationRules } from './useValidationRules'
import ValidationReportForm, { ValidationReportFormValues } from './ValidationReportForm'

// The form's data comes through these hooks and the picker; what is under
// test is what the form does with it.
jest.mock('./useReportConfig', () => ({ useReportConfig: jest.fn() }))
jest.mock('./useValidationRules', () => ({ useValidationRules: jest.fn() }))
jest.mock('./useDhis2PublicBaseUrl', () => ({ useDhis2PublicBaseUrl: jest.fn() }))
jest.mock('../authority/useAuthorities', () => ({ useAuthorities: jest.fn() }))
jest.mock('./fields/OrganisationUnitMultiSelect', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const mockedUseReportConfig = useReportConfig as jest.MockedFunction<typeof useReportConfig>
const mockedUseValidationRules = useValidationRules as jest.MockedFunction<
    typeof useValidationRules
>
const mockedUseAuthorities = useAuthorities as jest.MockedFunction<typeof useAuthorities>
const mockedUseDhis2PublicBaseUrl = useDhis2PublicBaseUrl as jest.MockedFunction<
    typeof useDhis2PublicBaseUrl
>
const mockedPicker = OrganisationUnitMultiSelect as unknown as jest.Mock

const CATALOGUE = [
    { id: 1, summary: 'The patient record has a registration.' },
    { id: 2, summary: 'The admission date is not in the future.' },
    { id: 25, summary: 'Every infection has an infectious agent.' },
]

describe('ValidationReportForm', () => {
    const initialLanguage = i18n.language
    let host: HTMLDivElement
    let root: Root
    let onSubmit: jest.Mock<void, [ValidationReportFormValues]>

    const renderForm = ({
        isAdmin = false,
        locales = ['en'],
        localesError = null,
        publicBaseUrl = { address: null, error: null },
    }: {
        isAdmin?: boolean
        locales?: string[] | null
        localesError?: Error | null
        publicBaseUrl?: Dhis2PublicBaseUrlState
    } = {}): void => {
        mockedUseAuthorities.mockReturnValue({ has: () => true, isAdmin })
        mockedUseDhis2PublicBaseUrl.mockReturnValue(publicBaseUrl)
        mockedUseReportConfig.mockReturnValue({
            presets: null,
            locales,
            presetsError: null,
            localesError,
        })
        mockedUseValidationRules.mockReturnValue({ rules: CATALOGUE, error: null })
        act(() => root.render(<ValidationReportForm onSubmit={onSubmit} />))
    }

    beforeEach(() => {
        onSubmit = jest.fn()
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

    const find = <E extends Element>(selector: string): E => {
        const found = host.querySelector<E>(selector)
        if (!found) throw new Error(`nothing matches ${selector} on the page`)
        return found
    }

    const click = (element: HTMLElement): void => {
        act(() => element.click())
    }

    /** "More options" is the form's one collapsible section. */
    const openMoreOptions = (): void => {
        const toggle = find<HTMLButtonElement>('button[aria-expanded]')
        expect(toggle.textContent).toContain('More options')
        click(toggle)
    }

    const selectAll = (): void => click(find<HTMLButtonElement>('button[name="selectAllRules"]'))
    const clearAll = (): void => click(find<HTMLButtonElement>('button[name="clearAllRules"]'))

    const ruleBox = (id: number): HTMLInputElement => find(`input[name="rule-${id}"]`)

    const checkedRules = (): number[] =>
        CATALOGUE.map((rule) => rule.id).filter((id) => ruleBox(id).checked)

    const submit = (): void => {
        act(() => host.querySelector('form')?.requestSubmit())
    }

    it('"Select all" ticks every rule, and the request then leaves the rules to the report', () => {
        renderForm()
        openMoreOptions()
        click(ruleBox(2))
        expect(checkedRules()).toEqual([1, 25])

        selectAll()

        expect(checkedRules()).toEqual([1, 2, 25])
        submit()
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].rules).toBeNull()
    })

    it('"Clear all" unticks every rule, and generating is then refused', () => {
        renderForm()
        openMoreOptions()

        clearAll()

        expect(checkedRules()).toEqual([])
        submit()
        expect(onSubmit).not.toHaveBeenCalled()
        expect(host.textContent).toContain('Select at least one validation rule.')
    })

    // The catalogue is fetched again when the interface language changes, and
    // that request can fail after the user has narrowed the selection.
    it.each([
        ['narrowed', (): void => click(ruleBox(2))],
        ['cleared', clearAll],
    ])(
        'sends no rules once the catalogue is unavailable, the earlier selection %s',
        (_state, change) => {
            renderForm()
            openMoreOptions()
            change()

            mockedUseValidationRules.mockReturnValue({
                rules: null,
                error: new Error('502 Bad Gateway'),
            })
            act(() => root.render(<ValidationReportForm onSubmit={onSubmit} />))
            submit()

            expect(onSubmit).toHaveBeenCalledTimes(1)
            expect(onSubmit.mock.calls[0][0].rules).toBeNull()
        }
    )

    it('offers "Include test data" to administrators only', () => {
        renderForm({ isAdmin: false })
        openMoreOptions()
        expect(host.querySelector('input[name="includeTestData"]')).toBeNull()

        act(() => root.unmount())
        root = createRoot(host)
        renderForm({ isAdmin: true })
        openMoreOptions()
        expect(host.querySelector('input[name="includeTestData"]')).not.toBeNull()
    })

    it('offers the validation-exception switches to administrators only, and sends their defaults otherwise', () => {
        renderForm({ isAdmin: false })
        openMoreOptions()
        expect(host.querySelector('input[name="applyValidationExceptions"]')).toBeNull()
        expect(host.querySelector('input[name="includeUnusedValidationExceptions"]')).toBeNull()
        // The address is an administrator's, so the form does not ask for it.
        expect(mockedUseDhis2PublicBaseUrl).toHaveBeenCalledWith(false)
        submit()
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            applyValidationExceptions: true,
            includeUnusedValidationExceptions: false,
        })
    })

    it('sends the appendix an administrator asks for, with the list applied', () => {
        renderForm({ isAdmin: true })
        openMoreOptions()
        expect(mockedUseDhis2PublicBaseUrl).toHaveBeenCalledWith(true)
        click(find<HTMLInputElement>('input[name="includeUnusedValidationExceptions"]'))
        submit()
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            applyValidationExceptions: true,
            includeUnusedValidationExceptions: true,
        })
    })

    it('takes the appendix with the list when an administrator switches the list off', () => {
        renderForm({ isAdmin: true })
        openMoreOptions()
        const appendix = () => find<HTMLInputElement>('input[name="includeUnusedValidationExceptions"]')
        click(appendix())
        expect(appendix().checked).toBe(true)
        click(find<HTMLInputElement>('input[name="applyValidationExceptions"]'))
        expect(appendix().checked).toBe(false)
        expect(appendix().disabled).toBe(true)
        submit()
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            applyValidationExceptions: false,
            includeUnusedValidationExceptions: false,
        })
        // Switching the list back on offers the appendix again, unticked.
        click(find<HTMLInputElement>('input[name="applyValidationExceptions"]'))
        expect(appendix().disabled).toBe(false)
        expect(appendix().checked).toBe(false)
    })

    it.each([
        [true, 'Patient links in the report point to https://dhis.example/.'],
        [
            false,
            'Patient links in the report point to http://dhis2:8080/, the DHIS2 address the reporting service reads from, because no public DHIS2 address is configured.',
        ],
    ])('shows an administrator the address patient links point to, configured: %p', (configured, text) => {
        const publicBaseUrl = configured ? 'https://dhis.example/' : 'http://dhis2:8080/'
        renderForm({ isAdmin: true, publicBaseUrl: { address: { publicBaseUrl, configured }, error: null } })
        openMoreOptions()
        expect(host.textContent).toContain(text)
    })

    it('says so when the address patient links point to could not be loaded', () => {
        renderForm({
            isAdmin: true,
            publicBaseUrl: { address: null, error: new Error('404 Not Found') },
        })
        openMoreOptions()
        expect(host.textContent).toContain(
            'The address the patient links point to could not be loaded.'
        )
    })

    it('sends the interface language for a blank report language when the report has it', () => {
        i18n.language = 'de-AT'
        renderForm({ locales: ['de', 'en'] })

        submit()

        expect(onSubmit.mock.calls[0][0].locale).toBe('de')
    })

    it('sends English for a blank report language when the report lacks the interface language', () => {
        i18n.language = 'fr'
        renderForm({ locales: ['de', 'en'] })

        submit()

        expect(onSubmit.mock.calls[0][0].locale).toBe('en')
    })

    it('shows Generate as loading, and does not generate, until the report languages load', () => {
        i18n.language = 'de'
        renderForm({ locales: null })

        const generate = find<HTMLButtonElement>('button[type="submit"]')
        expect(generate.disabled).toBe(true)
        expect(generate.querySelector('[role="progressbar"]')).not.toBeNull()
        click(generate)
        expect(onSubmit).not.toHaveBeenCalled()

        renderForm({ locales: ['de', 'en'] })

        expect(generate.disabled).toBe(false)
        click(generate)
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('de')
    })

    it('sends no language for a blank report language when the report languages failed to load', () => {
        i18n.language = 'de'
        renderForm({ locales: null, localesError: new Error('502 Bad Gateway') })

        const generate = find<HTMLButtonElement>('button[type="submit"]')
        expect(generate.disabled).toBe(false)
        click(generate)

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].locale).toBe('')
    })

    // Departments of the same name in two hospitals are told apart only by
    // the hospital the label names.
    it('names each department with its hospital in the picker', () => {
        renderForm()

        expect(mockedPicker).toHaveBeenCalled()
        expect(mockedPicker.mock.calls[0][0]).toMatchObject({
            name: 'departmentFilter',
            showParentInLabel: true,
        })
    })
})
