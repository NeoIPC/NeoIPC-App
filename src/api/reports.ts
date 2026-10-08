import i18n from '@dhis2/d2-i18n'
import { fetchNeoipcReporting } from './neoipcReporting'
import { includeElementKeys } from '../forms/enums'
import type { PartnerReportFormValues } from '../forms/PartnerReportForm'
import type { ReferenceReportFormValues } from '../forms/ReferenceReportForm'
import type { ValidationReportFormValues } from '../forms/ValidationReportForm'

/**
 * What the user picked in the form's "Output format" radio. Drives the
 * `Accept` header on the request and the post-response branch in
 * {@link renderPartnerReport} / {@link renderReferenceReport} /
 * {@link renderValidationReport}.
 */
export type OutputFormat = 'html' | 'pdf' | 'json'

/**
 * Successful render result. `html` carries the already-decoded body
 * fragment ready for `InlineHtmlReport`; every other format carries the
 * response as a {@link Blob} plus the filename to suggest in the
 * browser-download dialog (parsed from `Content-Disposition`, with a
 * generic fallback).
 */
export type RenderResult =
    | { format: 'html'; fragmentHtml: string }
    | { format: 'pdf' | 'json'; blob: Blob; suggestedFileName: string }

const ACCEPT_BY_FORMAT: Record<OutputFormat, string> = {
    html: 'text/html',
    pdf: 'application/pdf',
    json: 'application/json',
}

const appendString = (
    qs: URLSearchParams,
    key: string,
    value: string | null | undefined
): void => {
    if (value !== '' && value !== null && value !== undefined) {
        qs.append(key, value)
    }
}

const appendNumber = (
    qs: URLSearchParams,
    key: string,
    value: number | null | undefined
): void => {
    if (value !== null && value !== undefined) {
        qs.append(key, String(value))
    }
}

const appendBool = (
    qs: URLSearchParams,
    key: string,
    value: boolean | null | undefined
): void => {
    if (value !== null && value !== undefined) {
        qs.append(key, value ? 'true' : 'false')
    }
}

const appendArray = (
    qs: URLSearchParams,
    key: string,
    values: readonly string[] | null | undefined
): void => {
    if (!values) return
    for (const v of values) qs.append(key, v)
}

/**
 * Build the `URLSearchParams` for `GET /reference-report`. Empty /
 * `null` form values are dropped so the backend sees them as
 * "unspecified" rather than as zero / empty-string sentinels. When the
 * user picked a saved dataset, the live-fetch filters are skipped
 * unconditionally: the saved dataset fixes the cohort, so the reporting
 * service refuses those filters alongside it rather than ignoring them.
 */
export const buildReferenceReportQuery = (
    values: ReferenceReportFormValues,
    format: OutputFormat
): URLSearchParams => {
    const qs = new URLSearchParams()
    appendString(qs, 'referenceDataId', values.referenceDataId)
    appendString(qs, 'locale', values.locale)
    appendString(qs, 'confidenceIntervals', values.confidenceIntervals)
    appendNumber(qs, 'sparseDataThreshold', values.sparseDataThreshold)
    appendBool(qs, 'includeIntroductionTexts', values.includeIntroductionTexts)
    appendBool(qs, 'includeMethodsTexts', values.includeMethodsTexts)
    for (const key of includeElementKeys) {
        appendBool(qs, key, values[key])
    }

    if (values.referenceDataId === '') {
        appendString(qs, 'reportingPeriodFrom', values.reportingPeriodFrom)
        appendString(qs, 'reportingPeriodTo', values.reportingPeriodTo)
        appendNumber(qs, 'birthWeightFrom', values.birthWeightFrom)
        appendNumber(qs, 'birthWeightTo', values.birthWeightTo)
        appendNumber(qs, 'gestationalAgeFrom', values.gestationalAgeFrom)
        appendNumber(qs, 'gestationalAgeTo', values.gestationalAgeTo)
        appendArray(qs, 'countryFilter', values.countryFilter)
        appendArray(qs, 'departmentFilter', values.departmentFilter)
        appendBool(qs, 'testUnitFilter', values.testUnitFilter)
        appendBool(qs, 'defaultPatientFilter', values.defaultPatientFilter)
    }

    if (format === 'html') qs.append('fragmentMode', 'true')
    return qs
}

/**
 * Build the `URLSearchParams` for `GET /partner-report` (online mode)
 * or `POST /partner-report` (dataFile mode). Same rule: empty form
 * values are dropped. In dataFile mode the uploaded dataset fixes both
 * the department and the cohort, so the live-fetch filters (`unitCodes`,
 * period, weight/age, include-non-core / include-test) are not sent:
 * the backend refuses `unitCodes` outright there, because the report's
 * subtitle is front matter and cannot be corrected from the upload's
 * metadata, and it ignores the rest.
 */
export const buildPartnerReportQuery = (
    values: PartnerReportFormValues,
    format: OutputFormat
): URLSearchParams => {
    const qs = new URLSearchParams()
    appendString(qs, 'referenceDataFile', values.referenceDataFile)
    appendString(qs, 'locale', values.locale)
    appendString(qs, 'confidenceIntervals', values.confidenceIntervals)
    appendNumber(qs, 'sparseDataThreshold', values.sparseDataThreshold)
    appendBool(qs, 'includeIntroductionTexts', values.includeIntroductionTexts)
    appendBool(qs, 'includeMethodsTexts', values.includeMethodsTexts)
    appendBool(
        qs,
        'includeOutlierInterpretation',
        values.includeOutlierInterpretation
    )
    for (const key of includeElementKeys) {
        appendBool(qs, key, values[key])
    }

    if (values.mode === 'online') {
        appendArray(qs, 'unitCodes', values.unitCodes)
        appendString(qs, 'reportingPeriodFrom', values.reportingPeriodFrom)
        appendString(qs, 'reportingPeriodTo', values.reportingPeriodTo)
        appendNumber(qs, 'birthWeightFrom', values.birthWeightFrom)
        appendNumber(qs, 'birthWeightTo', values.birthWeightTo)
        appendNumber(qs, 'gestationalAgeFrom', values.gestationalAgeFrom)
        appendNumber(qs, 'gestationalAgeTo', values.gestationalAgeTo)
        appendBool(qs, 'includeNonCorePatients', values.includeNonCorePatients)
        appendBool(qs, 'includeTestData', values.includeTestData)
    }

    if (format === 'html') qs.append('fragmentMode', 'true')
    return qs
}

/**
 * Build the `URLSearchParams` for `GET /validation-report`. Empty form
 * values are dropped. `rules` is sent as repeated keys only for an explicit
 * selection: `null` selects every rule, which the report applies when the
 * parameter is absent, so the default request stays short. The two
 * validation-exception switches are always sent; the reporting service
 * judges them by value, refusing the non-default one from a caller who is no
 * administrator, so the defaults a non-administrator's form keeps pass.
 */
export const buildValidationReportQuery = (
    values: ValidationReportFormValues,
    format: OutputFormat
): URLSearchParams => {
    const qs = new URLSearchParams()
    appendString(qs, 'locale', values.locale)
    appendArray(qs, 'departmentFilter', values.departmentFilter)
    if (values.rules !== null) {
        appendArray(qs, 'rules', values.rules.map(String))
    }
    appendBool(qs, 'includeTestData', values.includeTestData)
    appendBool(qs, 'applyValidationExceptions', values.applyValidationExceptions)
    appendBool(
        qs,
        'includeUnusedValidationExceptions',
        values.includeUnusedValidationExceptions
    )
    if (format === 'html') qs.append('fragmentMode', 'true')
    return qs
}

/**
 * RFC 6266 / 5987 `Content-Disposition: attachment` parser scoped to
 * the two encodings the backend emits (`filename="..."` ASCII and
 * `filename*=UTF-8''...` percent-encoded). Returns `null` if the
 * header is absent or unparseable; callers fall back to a generic
 * default. Quoted ASCII filenames keep their inner `\"` escapes
 * intact via the JSON-string round-trip.
 */
const parseAttachmentFileName = (
    contentDisposition: string | null
): string | null => {
    if (!contentDisposition) return null

    const star = contentDisposition.match(/filename\*=([^;]+)/i)
    if (star) {
        const value = star[1].trim()
        const eqEq = value.indexOf("''")
        if (eqEq !== -1) {
            try {
                return decodeURIComponent(value.slice(eqEq + 2))
            } catch {
                return null
            }
        }
    }

    const quoted = contentDisposition.match(/filename="((?:[^"\\]|\\.)*)"/i)
    if (quoted) {
        try {
            return JSON.parse(`"${quoted[1]}"`) as string
        } catch {
            return null
        }
    }

    const bare = contentDisposition.match(/filename=([^;]+)/i)
    if (bare) return bare[1].trim()

    return null
}

const readRenderResult = async (
    response: Response,
    format: OutputFormat,
    fallbackBaseName: string
): Promise<RenderResult> => {
    if (format === 'html') {
        return { format, fragmentHtml: await response.text() }
    }
    return {
        format,
        blob: await response.blob(),
        // The remaining formats are named after their own extension, so the
        // fallback needs a stem rather than one spelling per format.
        suggestedFileName:
            parseAttachmentFileName(
                response.headers.get('content-disposition')
            ) ?? `${fallbackBaseName}.${format}`,
    }
}

/**
 * Render the Reference Report. `GET /reference-report` always; the
 * `Accept` header and `fragmentMode` query param branch on
 * {@link ReferenceReportFormValues.outputFormat}.
 */
export const renderReferenceReport = async (
    baseUrl: string,
    values: ReferenceReportFormValues
): Promise<RenderResult> => {
    const format = values.outputFormat
    const qs = buildReferenceReportQuery(values, format)
    const response = await fetchNeoipcReporting(
        baseUrl,
        `/reference-report?${qs.toString()}`,
        {
            method: 'GET',
            headers: { Accept: ACCEPT_BY_FORMAT[format] },
        }
    )
    return readRenderResult(response, format, 'reference-report')
}

/**
 * Render the Validation Report: `GET /validation-report`, with the `Accept`
 * header and `fragmentMode` branching on
 * {@link ValidationReportFormValues.outputFormat}. An empty `rules` selection
 * is refused before any request: a query string cannot tell an empty list
 * from an absent one, and the service applies every rule when `rules` is
 * absent, so the request would run the opposite of what was asked.
 */
export const renderValidationReport = async (
    baseUrl: string,
    values: ValidationReportFormValues
): Promise<RenderResult> => {
    if (values.rules !== null && values.rules.length === 0) {
        throw new Error(i18n.t('Select at least one validation rule.'))
    }

    const format = values.outputFormat
    const qs = buildValidationReportQuery(values, format)
    const response = await fetchNeoipcReporting(
        baseUrl,
        `/validation-report?${qs.toString()}`,
        {
            method: 'GET',
            headers: { Accept: ACCEPT_BY_FORMAT[format] },
        }
    )
    return readRenderResult(response, format, 'validation-report')
}

/**
 * Render the Partner Report. Online mode is `GET /partner-report`;
 * dataFile mode is `POST /partner-report` with the JSON file as the
 * raw request body. The reporting service disables antiforgery on that
 * route, so no CSRF token is needed.
 */
export const renderPartnerReport = async (
    baseUrl: string,
    values: PartnerReportFormValues
): Promise<RenderResult> => {
    if (values.mode === 'dataFile' && values.dataFile === null) {
        throw new Error(
            i18n.t('Please select a data file before submitting.')
        )
    }

    const format = values.outputFormat
    const qs = buildPartnerReportQuery(values, format)
    const path = `/partner-report?${qs.toString()}`
    const accept = ACCEPT_BY_FORMAT[format]

    const init: RequestInit =
        values.mode === 'dataFile'
            ? {
                  method: 'POST',
                  headers: {
                      Accept: accept,
                      'Content-Type':
                          values.dataFile!.type || 'application/json',
                  },
                  body: values.dataFile!,
              }
            : {
                  method: 'GET',
                  headers: { Accept: accept },
              }

    const response = await fetchNeoipcReporting(baseUrl, path, init)
    return readRenderResult(response, format, 'partner-report')
}

/**
 * Trigger a browser download from a {@link Blob} via a hidden,
 * temporarily-attached `<a download>` link. The blob URL is revoked
 * after the click so the browser can release the underlying memory.
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
