import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Card,
    CheckboxField,
    CircularLoader,
    NoticeBox,
    Radio,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { FC, useMemo, useState } from 'react'
import { useAuthorities } from '../authority/useAuthorities'
import { DEPARTMENT_GROUP_CODE, TEST_UNITS_GROUP_CODE } from '../config/dhis2Constants'
import CollapsibleSection from './CollapsibleSection'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import { languageLabel } from './languageLabel'
import { hasErrors, validateValidationReport } from './reportValidation'
import { useReportConfig } from './useReportConfig'
import { useValidationRules } from './useValidationRules'
import styles from './formLayout.module.css'

/**
 * Mirrors the on-the-wire shape the Validation-Report endpoint accepts.
 * Drift-checked by `scripts/check-schema-drift.mjs` against the schema
 * snapshot the reporting service publishes for this report.
 */
export interface ValidationReportFormValues {
    /** Department codes; empty = every department the session can see. */
    departmentFilter: string[]
    /** The rules to apply; `null` = every rule, which the request expresses
     *  by leaving the parameter out. */
    rules: number[] | null
    includeTestData: boolean
    locale: string
    outputFormat: 'html' | 'pdf'
}

/**
 * The form's initial values. A field the request always carries must
 * default to what the report schema declares; `formDefaults.test.ts` checks
 * every field with a schema default against these values.
 */
export const defaultValues: ValidationReportFormValues = {
    departmentFilter: [],
    rules: null,
    includeTestData: false,
    locale: '',
    outputFormat: 'html',
}

interface ValidationReportFormProps {
    onSubmit?: (values: ValidationReportFormValues) => void
    /** Disable the submit button and show a loading spinner on it. */
    submitting?: boolean
}

const ValidationReportForm: FC<ValidationReportFormProps> = ({
    onSubmit,
    submitting = false,
}) => {
    const { locales } = useReportConfig('validation-report', { presets: false })
    const { rules: catalogue, error: catalogueError } = useValidationRules()
    const { isAdmin } = useAuthorities()
    const [values, setValues] = useState<ValidationReportFormValues>(defaultValues)
    // Client-side preconditions are only surfaced after the first Generate
    // attempt, then re-evaluated live as the user fixes each field.
    const [submitAttempted, setSubmitAttempted] = useState(false)
    const errors = useMemo(
        () => (submitAttempted ? validateValidationReport(values) : {}),
        [submitAttempted, values]
    )

    const hasLanguageChoice = (locales?.length ?? 0) > 1
    const allIds = useMemo(() => (catalogue ?? []).map((rule) => rule.id), [catalogue])

    const setField = <K extends keyof ValidationReportFormValues>(key: K) =>
        (value: ValidationReportFormValues[K]) =>
            setValues((prev) => ({ ...prev, [key]: value }))

    const isRuleSelected = (id: number): boolean =>
        values.rules === null || values.rules.includes(id)

    // A selection of every rule is stored as `null`, so the request leaves
    // `rules` out and the report applies its own full set.
    const toggleRule = (id: number, checked: boolean): void =>
        setValues((prev) => {
            const current = prev.rules ?? allIds
            const next = checked
                ? [...current.filter((r) => r !== id), id].sort((a, b) => a - b)
                : current.filter((r) => r !== id)
            const everyRule = allIds.length > 0 && allIds.every((r) => next.includes(r))
            return { ...prev, rules: everyRule ? null : next }
        })

    // `TEST_UNITS` holds departments: offering a test department while the
    // report leaves test units out would resolve to no department at render
    // time, so the picker drops them unless test data is requested.
    const departmentExcludeGroups = useMemo(
        () => (values.includeTestData ? [] : [TEST_UNITS_GROUP_CODE]),
        [values.includeTestData]
    )

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault()
                setSubmitAttempted(true)
                if (hasErrors(validateValidationReport(values))) return
                onSubmit?.(values)
            }}
        >
            <Card>
                <fieldset>
                    <legend>{i18n.t('Output format')}</legend>
                    <Radio
                        name="outputFormat"
                        label={i18n.t('View as HTML')}
                        value="html"
                        checked={values.outputFormat === 'html'}
                        onChange={() => setField('outputFormat')('html')}
                    />
                    <Radio
                        name="outputFormat"
                        label={i18n.t('Download as PDF')}
                        value="pdf"
                        checked={values.outputFormat === 'pdf'}
                        onChange={() => setField('outputFormat')('pdf')}
                    />
                </fieldset>
            </Card>

            <Card>
                <h2>{i18n.t('Departments')}</h2>
                <OrganisationUnitMultiSelect
                    name="departmentFilter"
                    label={i18n.t('Departments')}
                    groupCode={DEPARTMENT_GROUP_CODE}
                    excludeGroupCodes={departmentExcludeGroups}
                    selectedCodes={values.departmentFilter}
                    onChange={setField('departmentFilter')}
                    helpText={i18n.t(
                        'Leave empty to validate every department you can see.'
                    )}
                />
            </Card>

            <CollapsibleSection
                title={i18n.t('More options')}
                forceOpen={Boolean(errors.rules)}
            >
                <fieldset>
                    <legend>{i18n.t('Validation rules')}</legend>
                    {catalogueError && (
                        <NoticeBox warning title={i18n.t('The rule list could not be loaded')}>
                            {i18n.t('The report applies every rule.')}
                        </NoticeBox>
                    )}
                    {catalogue === null && !catalogueError && <CircularLoader small />}
                    {catalogue !== null && (
                        <>
                            <ButtonStrip>
                                <Button
                                    small
                                    name="selectAllRules"
                                    onClick={() => setField('rules')(null)}
                                >
                                    {i18n.t('Select all')}
                                </Button>
                                <Button
                                    small
                                    name="clearAllRules"
                                    onClick={() => setField('rules')([])}
                                >
                                    {i18n.t('Clear all')}
                                </Button>
                            </ButtonStrip>
                            <div className={styles.checkboxGrid}>
                                {catalogue.map((rule) => (
                                    <CheckboxField
                                        key={rule.id}
                                        name={`rule-${rule.id}`}
                                        label={i18n.t('Rule {{id}}', { id: rule.id })}
                                        helpText={rule.summary}
                                        checked={isRuleSelected(rule.id)}
                                        onChange={({ checked }) => toggleRule(rule.id, checked)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </fieldset>

                {isAdmin && (
                    <CheckboxField
                        name="includeTestData"
                        label={i18n.t('Include test data')}
                        checked={values.includeTestData}
                        onChange={({ checked }) => setField('includeTestData')(checked)}
                    />
                )}

                {hasLanguageChoice && (
                    <>
                        <h3>{i18n.t('Language')}</h3>
                        <SingleSelectField
                            label={i18n.t('Report language')}
                            helpText={i18n.t(
                                'Leave blank to use the locale from your DHIS2 user setting.'
                            )}
                            selected={
                                values.locale === '' ||
                                (locales ?? []).includes(values.locale)
                                    ? values.locale
                                    : undefined
                            }
                            loading={locales === null}
                            onChange={({ selected }) => setField('locale')(selected ?? '')}
                        >
                            <SingleSelectOption
                                value=""
                                label={i18n.t('(use DHIS2 user setting)')}
                            />
                            {(locales ?? []).map((loc) => (
                                <SingleSelectOption
                                    key={loc}
                                    value={loc}
                                    label={languageLabel(loc)}
                                />
                            ))}
                        </SingleSelectField>
                    </>
                )}
            </CollapsibleSection>

            {submitAttempted && hasErrors(errors) && (
                <NoticeBox error title={i18n.t('Please correct the highlighted fields')}>
                    <ul>
                        {Object.entries(errors).map(([field, message]) => (
                            <li key={field}>{message}</li>
                        ))}
                    </ul>
                </NoticeBox>
            )}

            <Button primary type="submit" disabled={submitting} loading={submitting}>
                {i18n.t('Generate')}
            </Button>
        </form>
    )
}

export default ValidationReportForm
