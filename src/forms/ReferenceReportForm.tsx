import i18n from '@dhis2/d2-i18n'
import {
    Button,
    Card,
    CheckboxField,
    InputField,
    NoticeBox,
    Radio,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { FC, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../AppContext'
import { useAuthorities } from '../authority/useAuthorities'
import {
    COUNTRY_GROUP_CODE,
    DEPARTMENT_GROUP_CODE,
    TEST_UNITS_GROUP_CODE,
} from '../config/dhis2Constants'
import CollapsibleSection from './CollapsibleSection'
import DateField from './fields/DateField'
import NumberRangeField from './fields/NumberRangeField'
import OrganisationUnitMultiSelect from './fields/OrganisationUnitMultiSelect'
import { useOrgUnitNames } from './fields/useOrgUnitNames'
import ReferenceDataSelect from './ReferenceDataSelect'
import PresetSelect, { CUSTOM_PRESET } from './PresetSelect'
import { governedKeys, resolvePresetValues } from './applyPreset'
import { languageLabel } from './languageLabel'
import { hasErrors, validateReferenceReport } from './reportValidation'
import { useReportConfig } from './useReportConfig'
import {
    ConfidenceIntervalMode,
    ConfidenceIntervalModeValues,
    confidenceIntervalModeLabel,
    includeElementKeys,
    includeElementLabel,
} from './enums'
import styles from './formLayout.module.css'

/**
 * Mirrors the on-the-wire shape the Reference-Report endpoint accepts.
 * Drift-checked by `scripts/check-schema-drift.mjs` against the schema
 * snapshot the reporting service publishes for this report.
 */
export interface ReferenceReportFormValues {
    /** UID of a saved reference dataset (from {@link useAppContext}).
     *  When set, the live-fetch filters are disabled and the report
     *  consumes the pre-computed dataset. */
    referenceDataId: string
    reportingPeriodFrom: string
    reportingPeriodTo: string
    birthWeightFrom: number | null
    birthWeightTo: number | null
    gestationalAgeFrom: number | null
    gestationalAgeTo: number | null
    countryFilter: string[]
    departmentFilter: string[]
    /** `null` = backend default. */
    testUnitFilter: boolean | null
    /** `null` = backend default. */
    defaultPatientFilter: boolean | null
    sparseDataThreshold: number | null
    confidenceIntervals: ConfidenceIntervalMode | ''
    includeIntroductionTexts: boolean
    includeMethodsTexts: boolean
    includeBirthWeightFigure: boolean
    includeGestationalAgeFigure: boolean
    includeIncidenceDensityTable: boolean
    includeDeviceAssociatedIncidenceDensityTable: boolean
    includeAgentPerInfectionRateTable: boolean
    includeInfectiousAgentDetectionRateTable: boolean
    includeRiskDensityRateTable: boolean
    includeAntibioticUtilisationTable: boolean
    includeSurgicalProcedureRateTable: boolean
    includeResistantPathogenInfectionRateTable: boolean
    includeOrganismResistanceRateTable: boolean
    includeAntibioticResistanceTestRateTable: boolean
    includeSecondaryBsiRateTable: boolean
    locale: string
    outputFormat: 'html' | 'pdf'
}

/**
 * The form's initial values; the `default` preset restores the
 * content-governing ones among them. A field the request always carries
 * must default to what the report schema declares, or an untouched form
 * would render something other than the report's own default;
 * `formDefaults.test.ts` checks every field with a schema default against
 * these values.
 */
export const defaultValues: ReferenceReportFormValues = {
    referenceDataId: '',
    reportingPeriodFrom: '',
    reportingPeriodTo: '',
    birthWeightFrom: null,
    birthWeightTo: null,
    gestationalAgeFrom: null,
    gestationalAgeTo: null,
    countryFilter: [],
    departmentFilter: [],
    testUnitFilter: null,
    defaultPatientFilter: null,
    sparseDataThreshold: null,
    confidenceIntervals: '',
    includeIntroductionTexts: true,
    includeMethodsTexts: true,
    includeBirthWeightFigure: true,
    includeGestationalAgeFigure: true,
    includeIncidenceDensityTable: true,
    includeDeviceAssociatedIncidenceDensityTable: true,
    includeAgentPerInfectionRateTable: true,
    includeInfectiousAgentDetectionRateTable: true,
    includeRiskDensityRateTable: true,
    includeAntibioticUtilisationTable: false,
    includeSurgicalProcedureRateTable: true,
    includeResistantPathogenInfectionRateTable: false,
    includeOrganismResistanceRateTable: false,
    includeAntibioticResistanceTestRateTable: false,
    includeSecondaryBsiRateTable: false,
    locale: '',
    outputFormat: 'html',
}

interface ReferenceReportFormProps {
    onSubmit?: (values: ReferenceReportFormValues) => void
    /** Disable the submit button and show a loading spinner on it. */
    submitting?: boolean
}

const ReferenceReportForm: FC<ReferenceReportFormProps> = ({
    onSubmit,
    submitting = false,
}) => {
    const { referenceDataSets } = useAppContext()
    const { presets, locales } = useReportConfig('reference-report')
    const { isAdmin } = useAuthorities()
    const countryNames = useOrgUnitNames(COUNTRY_GROUP_CODE)
    const [values, setValues] = useState<ReferenceReportFormValues>(
        defaultValues
    )
    const [preset, setPreset] = useState<string>('default')
    // Client-side preconditions are only surfaced after the first Generate
    // attempt, then re-evaluated live as the user fixes each field.
    const [submitAttempted, setSubmitAttempted] = useState(false)
    const errors = useMemo(
        () => (submitAttempted ? validateReferenceReport(values) : {}),
        [submitAttempted, values]
    )

    // A report cannot render against "(none)", so preselect the first available
    // saved dataset once the listing has loaded — leaving the user free to change
    // it, or (as an admin) clear it for live-fetch. Guarded so it runs once and
    // never overrides a later choice.
    const [datasetPreselected, setDatasetPreselected] = useState(false)
    useEffect(() => {
        if (datasetPreselected || referenceDataSets.length === 0) return
        setDatasetPreselected(true)
        setValues((prev) =>
            prev.referenceDataId === ''
                ? { ...prev, referenceDataId: referenceDataSets[0].id }
                : prev
        )
    }, [datasetPreselected, referenceDataSets])

    const presetLocked = preset !== CUSTOM_PRESET
    // Only offer a language picker when the backend advertises more than one
    // render-ready language; today English is the only one, so it stays hidden
    // (mirrors the Partner Report form).
    const hasLanguageChoice = (locales?.length ?? 0) > 1

    const setField = <K extends keyof ReferenceReportFormValues>(key: K) =>
        (value: ReferenceReportFormValues[K]) =>
            setValues((prev) => ({ ...prev, [key]: value }))

    const governedDefaults = useMemo<Record<string, boolean | string>>(
        () => Object.fromEntries(governedKeys.map((k) => [k, defaultValues[k]])),
        []
    )

    const applyPreset = (name: string): void => {
        setPreset(name)
        if (name === CUSTOM_PRESET) return
        const resolved = resolvePresetValues(presets?.[name] ?? {}, governedDefaults)
        setValues((prev) => ({
            ...prev,
            ...(resolved as Partial<ReferenceReportFormValues>),
        }))
    }

    const usingSavedDataset = values.referenceDataId !== ''
    // `TEST_UNITS` holds departments, so this is the one picker the setting
    // can act on — offering a test department while the data layer drops it
    // would resolve to an empty org-unit set at render time. Countries are
    // never members, which is why that picker takes no exclusion.
    const departmentExcludeGroups = useMemo(
        () => (values.testUnitFilter === false ? [] : [TEST_UNITS_GROUP_CODE]),
        [values.testUnitFilter]
    )

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault()
                setSubmitAttempted(true)
                if (hasErrors(validateReferenceReport(values))) return
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
                <h2>{i18n.t('Reference dataset')}</h2>
                <ReferenceDataSelect
                    datasets={referenceDataSets}
                    value={values.referenceDataId}
                    onChange={setField('referenceDataId')}
                    dataTest="referenceDataId"
                    allowNone={isAdmin}
                    countryNames={countryNames}
                    helpText={
                        isAdmin
                            ? i18n.t(
                                  'Pick a pre-computed dataset, or leave empty ' +
                                      'to compute reference data live from the ' +
                                      'admin filters below.'
                              )
                            : i18n.t(
                                  'Pick a pre-computed reference dataset to render.'
                              )
                    }
                />
            </Card>

            {isAdmin && (
                <CollapsibleSection
                    title={i18n.t('Live-fetch filters (admins only)')}
                    forceOpen={Boolean(
                        errors.reportingPeriod ||
                            errors.birthWeight ||
                            errors.gestationalAge
                    )}
                >
                    <p>
                        {usingSavedDataset
                            ? i18n.t(
                                  'Disabled — a saved dataset is selected above.'
                              )
                            : i18n.t(
                                  'Used when no saved reference dataset is selected.'
                              )}
                    </p>
                    {/* `testUnitFilter` is an apply-the-filter flag, so true —
                        its backend default — is what *excludes* test units.
                        The checkbox states the outcome the user gets, which
                        makes the mapping inverted; unchecking omits the
                        parameter rather than sending true, leaving the
                        exclusion to the same default a preset-free request
                        already gets. */}
                    <CheckboxField
                        name="testUnitFilter"
                        label={i18n.t('Include test data')}
                        checked={values.testUnitFilter === false}
                        onChange={({ checked }) =>
                            setField('testUnitFilter')(checked ? false : null)
                        }
                        disabled={usingSavedDataset}
                    />
                    <OrganisationUnitMultiSelect
                        name="countryFilter"
                        label={i18n.t('Countries')}
                        groupCode={COUNTRY_GROUP_CODE}
                        selectedCodes={values.countryFilter}
                        onChange={setField('countryFilter')}
                        disabled={usingSavedDataset}
                    />
                    <OrganisationUnitMultiSelect
                        name="departmentFilter"
                        label={i18n.t('Departments')}
                        groupCode={DEPARTMENT_GROUP_CODE}
                        excludeGroupCodes={departmentExcludeGroups}
                        selectedCodes={values.departmentFilter}
                        onChange={setField('departmentFilter')}
                        disabled={usingSavedDataset}
                    />
                    <SingleSelectField
                        label={i18n.t('Default patient filter')}
                        selected={
                            values.defaultPatientFilter === null
                                ? ''
                                : values.defaultPatientFilter
                                  ? 'true'
                                  : 'false'
                        }
                        onChange={({ selected }) =>
                            setField('defaultPatientFilter')(
                                selected === '' ? null : selected === 'true'
                            )
                        }
                        disabled={usingSavedDataset}
                    >
                        <SingleSelectOption value="" label={i18n.t('(backend default)')} />
                        <SingleSelectOption value="true" label={i18n.t('Apply')} />
                        <SingleSelectOption value="false" label={i18n.t('Skip')} />
                    </SingleSelectField>
                    <h3>{i18n.t('Reporting period')}</h3>
                    <div className={styles.rowTwo}>
                        <DateField
                            name="reportingPeriodFrom"
                            label={i18n.t('From')}
                            value={values.reportingPeriodFrom}
                            onChange={setField('reportingPeriodFrom')}
                            disabled={usingSavedDataset}
                            error={Boolean(errors.reportingPeriod)}
                        />
                        <DateField
                            name="reportingPeriodTo"
                            label={i18n.t('To')}
                            value={values.reportingPeriodTo}
                            onChange={setField('reportingPeriodTo')}
                            disabled={usingSavedDataset}
                            error={Boolean(errors.reportingPeriod)}
                            validationText={errors.reportingPeriod}
                        />
                    </div>
                    <h3>{i18n.t('Patient population filters')}</h3>
                    <NumberRangeField
                        name="birthWeight"
                        label={i18n.t('Birth weight (g)')}
                        fromValue={values.birthWeightFrom}
                        toValue={values.birthWeightTo}
                        onFromChange={setField('birthWeightFrom')}
                        onToChange={setField('birthWeightTo')}
                        min={0}
                        max={65535}
                        disabled={usingSavedDataset}
                        error={Boolean(errors.birthWeight)}
                        validationText={errors.birthWeight}
                    />
                    <NumberRangeField
                        name="gestationalAge"
                        label={i18n.t('Gestational age (weeks)')}
                        fromValue={values.gestationalAgeFrom}
                        toValue={values.gestationalAgeTo}
                        onFromChange={setField('gestationalAgeFrom')}
                        onToChange={setField('gestationalAgeTo')}
                        min={0}
                        max={52}
                        disabled={usingSavedDataset}
                        error={Boolean(errors.gestationalAge)}
                        validationText={errors.gestationalAge}
                    />
                    <InputField
                        label={i18n.t('Sparse data threshold')}
                        name="sparseDataThreshold"
                        type="number"
                        value={
                            values.sparseDataThreshold === null
                                ? ''
                                : String(values.sparseDataThreshold)
                        }
                        disabled={usingSavedDataset}
                        onChange={({ value }) =>
                            setField('sparseDataThreshold')(
                                value === '' || value === undefined
                                    ? null
                                    : Number(value)
                            )
                        }
                    />
                </CollapsibleSection>
            )}

            <CollapsibleSection title={i18n.t('More options')}>
                <h3>{i18n.t('Content')}</h3>
                <PresetSelect
                    presets={presets}
                    value={preset}
                    onChange={applyPreset}
                />
                <div className={styles.checkboxGrid}>
                    {includeElementKeys.map((key) => (
                        <CheckboxField
                            key={key}
                            name={key}
                            label={includeElementLabel(key)}
                            checked={values[key]}
                            disabled={presetLocked}
                            onChange={({ checked }) => setField(key)(checked)}
                        />
                    ))}
                </div>
                <SingleSelectField
                    label={i18n.t('Confidence intervals')}
                    helpText={i18n.t('Backend default if unset.')}
                    selected={values.confidenceIntervals}
                    disabled={presetLocked}
                    onChange={({ selected }) =>
                        setField('confidenceIntervals')(
                            selected as ConfidenceIntervalMode | ''
                        )
                    }
                >
                    <SingleSelectOption
                        value=""
                        label={i18n.t('(backend default)')}
                    />
                    {ConfidenceIntervalModeValues.map((mode) => (
                        <SingleSelectOption
                            key={mode}
                            value={mode}
                            label={confidenceIntervalModeLabel(mode)}
                        />
                    ))}
                </SingleSelectField>
                <CheckboxField
                    name="includeIntroductionTexts"
                    label={i18n.t('Include introduction texts')}
                    checked={values.includeIntroductionTexts}
                    disabled={presetLocked}
                    onChange={({ checked }) =>
                        setField('includeIntroductionTexts')(checked)
                    }
                />
                <CheckboxField
                    name="includeMethodsTexts"
                    label={i18n.t('Include methods texts')}
                    checked={values.includeMethodsTexts}
                    disabled={presetLocked}
                    onChange={({ checked }) =>
                        setField('includeMethodsTexts')(checked)
                    }
                />

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
                            onChange={({ selected }) =>
                                setField('locale')(selected ?? '')
                            }
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
                <NoticeBox
                    error
                    title={i18n.t('Please correct the highlighted fields')}
                >
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
                disabled={
                    submitting || (!isAdmin && values.referenceDataId === '')
                }
                loading={submitting}
            >
                {i18n.t('Generate')}
            </Button>
        </form>
    )
}

export default ReferenceReportForm
