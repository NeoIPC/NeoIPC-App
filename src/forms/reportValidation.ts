import i18n from '@dhis2/d2-i18n'
import type { PartnerReportFormValues } from './PartnerReportForm'
import type { ReferenceReportFormValues } from './ReferenceReportForm'
import type { ValidationReportFormValues } from './ValidationReportForm'

/**
 * Client-side precondition errors keyed by a form-field identifier. A key
 * names a *control* (or a paired range control), not a wire parameter, so
 * the form can drive that control's `@dhis2/ui` error / `validationText`
 * state. Absent key ⇒ that field is valid. The same shape is the intended
 * target for mapping backend `problem+json` errors to field(s) in the
 * follow-up slice, so field-scoped server errors can reuse this rendering.
 */
export type FieldErrors<K extends string = string> = Partial<Record<K, string>>

/** Whether any field carries an error. */
export const hasErrors = (errors: FieldErrors): boolean =>
    Object.keys(errors).length > 0

/** A numeric `from`/`to` pair is inverted only when both ends are set and from > to. */
const numberRangeInverted = (
    from: number | null,
    to: number | null
): boolean => from !== null && to !== null && from > to

/**
 * An ISO `YYYY-MM-DD` `from`/`to` pair is inverted only when both ends are
 * set and from is after to. ISO dates compare correctly as strings.
 */
const dateRangeInverted = (from: string, to: string): boolean =>
    from !== '' && to !== '' && from > to

const RANGE_INVERTED = (): string =>
    i18n.t('The "from" value must not exceed the "to" value.')

const DATE_RANGE_INVERTED = (): string =>
    i18n.t('The start date must not be after the end date.')

export type PartnerFieldKey =
    | 'unitCodes'
    | 'dataFile'
    | 'reportingPeriod'
    | 'birthWeight'
    | 'gestationalAge'

/**
 * Preconditions the Partner Report form can check before submitting, so a
 * predictable 400 (missing departments, no file, inverted range) is caught
 * as a friendly field message instead of a raw backend error. Fields hidden
 * in the current mode are not validated (the backend ignores them too):
 * online mode has the departments + cohort filters; dataFile mode has only
 * the uploaded file.
 */
export const validatePartnerReport = (
    values: PartnerReportFormValues
): FieldErrors<PartnerFieldKey> => {
    const errors: FieldErrors<PartnerFieldKey> = {}
    if (values.mode === 'online') {
        if (values.unitCodes.length === 0) {
            errors.unitCodes = i18n.t('Select at least one department.')
        }
        if (dateRangeInverted(values.reportingPeriodFrom, values.reportingPeriodTo)) {
            errors.reportingPeriod = DATE_RANGE_INVERTED()
        }
        if (numberRangeInverted(values.birthWeightFrom, values.birthWeightTo)) {
            errors.birthWeight = RANGE_INVERTED()
        }
        if (
            numberRangeInverted(
                values.gestationalAgeFrom,
                values.gestationalAgeTo
            )
        ) {
            errors.gestationalAge = RANGE_INVERTED()
        }
    } else if (values.dataFile === null) {
        errors.dataFile = i18n.t('Choose a data file to upload.')
    }
    return errors
}

export type ReferenceFieldKey =
    | 'reportingPeriod'
    | 'birthWeight'
    | 'gestationalAge'

/**
 * Preconditions the Reference Report form can check before submitting. The
 * cohort filters only apply when computing live from filters (no saved
 * dataset selected); a saved dataset disables them, so they are not
 * validated then. The "a non-admin must pick a saved dataset" requirement
 * is already enforced by disabling Generate, so it needs no field error.
 */
export const validateReferenceReport = (
    values: ReferenceReportFormValues
): FieldErrors<ReferenceFieldKey> => {
    const errors: FieldErrors<ReferenceFieldKey> = {}
    const usingSavedDataset = values.referenceDataId !== ''
    if (!usingSavedDataset) {
        if (dateRangeInverted(values.reportingPeriodFrom, values.reportingPeriodTo)) {
            errors.reportingPeriod = DATE_RANGE_INVERTED()
        }
        if (numberRangeInverted(values.birthWeightFrom, values.birthWeightTo)) {
            errors.birthWeight = RANGE_INVERTED()
        }
        if (
            numberRangeInverted(
                values.gestationalAgeFrom,
                values.gestationalAgeTo
            )
        ) {
            errors.gestationalAge = RANGE_INVERTED()
        }
    }
    return errors
}

export type ValidationFieldKey = 'rules'

/**
 * Client-side preconditions for the Validation Report: at least one rule
 * must be selected, since a report applying none would list nothing.
 * `rules === null` selects every rule.
 */
export const validateValidationReport = (
    values: ValidationReportFormValues
): FieldErrors<ValidationFieldKey> => {
    const errors: FieldErrors<ValidationFieldKey> = {}
    if (values.rules !== null && values.rules.length === 0) {
        errors.rules = i18n.t('Select at least one validation rule.')
    }
    return errors
}
