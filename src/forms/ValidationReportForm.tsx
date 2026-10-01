import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Card,
    CheckboxField,
    CircularLoader,
    Help,
    NoticeBox,
    Radio,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { FC, useId, useMemo, useState } from 'react'
import { useAuthorities } from '../authority/useAuthorities'
import { DEPARTMENT_GROUP_CODE, TEST_UNITS_GROUP_CODE } from '../config/dhis2Constants'
import CollapsibleSection from './CollapsibleSection'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import { OrgUnitRow, allCodedUnitsExcluded } from './fields/orgUnits'
import { languageLabel } from './languageLabel'
import { withReportLocale } from './reportLocale'
import { hasErrors, validateValidationReport } from './reportValidation'
import { toggleRuleSelection } from './ruleSelection'
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
    const { locales, localesError } = useReportConfig('validation-report', {
        presets: false,
    })
    const { rules: catalogue, error: catalogueError } = useValidationRules()
    const { isAdmin } = useAuthorities()
    const rulesErrorId = useId()
    const [values, setValues] = useState<ValidationReportFormValues>(defaultValues)
    const [deptRows, setDeptRows] = useState<OrgUnitRow[]>([])
    // Client-side preconditions are only surfaced after the first Generate
    // attempt, then re-evaluated live as the user fixes each field.
    const [submitAttempted, setSubmitAttempted] = useState(false)

    const hasLanguageChoice = (locales?.length ?? 0) > 1
    // A blank report language is resolved against the locale list, so
    // Generate waits for the list; if the list fails to load, a blank
    // language is left out of the request.
    const localesPending = locales === null && localesError === null
    const allIds = useMemo(() => (catalogue ?? []).map((rule) => rule.id), [catalogue])
    // An empty catalogue offers nothing to choose, so it is treated like one
    // that failed to load: the request leaves `rules` out and the report
    // applies its own full set.
    const catalogueUnavailable = catalogueError !== null || catalogue?.length === 0
    // A selection made against an earlier catalogue, before a refetch for
    // another interface language failed, stands for nothing the form still
    // shows, so it is neither validated nor sent.
    const effectiveValues = useMemo(
        () => (catalogueUnavailable ? { ...values, rules: null } : values),
        [catalogueUnavailable, values]
    )
    const errors = useMemo(
        () => (submitAttempted ? validateValidationReport(effectiveValues) : {}),
        [submitAttempted, effectiveValues]
    )

    const setField = <K extends keyof ValidationReportFormValues>(key: K) =>
        (value: ValidationReportFormValues[K]) =>
            setValues((prev) => ({ ...prev, [key]: value }))

    const isRuleSelected = (id: number): boolean =>
        values.rules === null || values.rules.includes(id)

    const toggleRule = (id: number, checked: boolean): void =>
        setValues((prev) => ({
            ...prev,
            rules: toggleRuleSelection(prev.rules, allIds, id, checked),
        }))

    // `TEST_UNITS` holds departments: a member picked while the report leaves
    // test units out would fail the render when picked alone and be left out
    // of it when picked with others, so the picker drops its members unless
    // test data is requested.
    const departmentExcludeGroups = useMemo(
        () => (values.includeTestData ? [] : [TEST_UNITS_GROUP_CODE]),
        [values.includeTestData]
    )
    // When the user's whole department scope is test units, the picker is
    // empty and an empty picker would validate no department at all rather
    // than every one, so say why instead of leaving a blank control.
    const noSelectableDepartments = useMemo(
        () => allCodedUnitsExcluded(deptRows, departmentExcludeGroups),
        [deptRows, departmentExcludeGroups]
    )

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault()
                setSubmitAttempted(true)
                if (hasErrors(validateValidationReport(effectiveValues))) return
                onSubmit?.(withReportLocale(effectiveValues, i18n.language, locales))
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
                {noSelectableDepartments && (
                    <NoticeBox warning title={i18n.t('No selectable departments')}>
                        {isAdmin
                            ? i18n.t(
                                  'All departments in your scope are test units. Turn on "Include test data" under More options to select them.'
                              )
                            : i18n.t(
                                  'All departments in your scope are test units, which are excluded from reports. Ask an administrator to include test data.'
                              )}
                    </NoticeBox>
                )}
                <OrganisationUnitMultiSelect
                    name="departmentFilter"
                    label={i18n.t('Departments')}
                    groupCode={DEPARTMENT_GROUP_CODE}
                    excludeGroupCodes={departmentExcludeGroups}
                    showParentInLabel
                    selectedCodes={values.departmentFilter}
                    onChange={setField('departmentFilter')}
                    onRowsLoaded={setDeptRows}
                    helpText={i18n.t(
                        'Leave empty to validate every department you can see.'
                    )}
                />
            </Card>

            <CollapsibleSection
                title={i18n.t('More options')}
                forceOpen={Boolean(errors.rules)}
            >
                <fieldset aria-describedby={errors.rules ? rulesErrorId : undefined}>
                    <legend>{i18n.t('Validation rules')}</legend>
                    {errors.rules && (
                        <div id={rulesErrorId}>
                            <Help error>{errors.rules}</Help>
                        </div>
                    )}
                    {catalogueUnavailable && (
                        <NoticeBox warning title={i18n.t('The rule list could not be loaded')}>
                            {i18n.t('The report applies every rule.')}
                        </NoticeBox>
                    )}
                    {catalogue === null && !catalogueError && (
                        <CircularLoader
                            small
                            aria-label={i18n.t('Loading the validation rules')}
                        />
                    )}
                    {catalogue !== null && catalogue.length > 0 && (
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
                                        className={styles.ruleField}
                                        // The summary sits inside the label, not in
                                        // `helpText`: @dhis2/ui renders help text as a
                                        // sibling paragraph nothing links to the input,
                                        // which would leave every checkbox named only
                                        // "Rule N" to assistive technology.
                                        label={
                                            <span className={styles.ruleLabel}>
                                                <span>
                                                    {i18n.t('Rule {{id}}', { id: rule.id })}
                                                </span>{' '}
                                                <span className={styles.ruleSummary}>
                                                    {rule.summary}
                                                </span>
                                            </span>
                                        }
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
                                'Leave blank to use your DHIS2 interface language if the report is available in it, and English otherwise.'
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
                                label={i18n.t('(interface language if available, otherwise English)')}
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

            <Button
                primary
                type="submit"
                disabled={submitting || localesPending}
                loading={submitting || localesPending}
            >
                {i18n.t('Generate')}
            </Button>
        </form>
    )
}

export default ValidationReportForm
