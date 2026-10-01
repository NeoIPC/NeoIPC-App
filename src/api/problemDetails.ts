import i18n from '@dhis2/d2-i18n'
import { NeoipcReportingError } from './neoipcReporting'

/** The RFC 7807 problem+json fields the app reads. */
interface ProblemBody {
    /** Stable machine-readable code (NeoIPC-Reporting `ProblemCodes`). */
    code?: string
    title?: string
    detail?: string
}

/**
 * Friendly, localized, user-domain message for a backend problem+json
 * `code`. Where an error is scoped to a form control the message names that
 * control in prose: the reachable preconditions (missing department/file,
 * inverted ranges) are already caught and field-highlighted client-side
 * before submit, and the remaining server-side field-scoped cases
 * (unsupported locale, stale benchmark dataset) are near-unreachable from the
 * UI — the app only offers advertised locales and already-fetched datasets —
 * so a clear message is the right level rather than highlighting a control
 * the user can barely reach. Returns `null` for an unknown code so the caller
 * falls back to the backend title/detail.
 */
const messageForCode = (code: string): string | null => {
    switch (code) {
        case 'missing-unit-codes':
            return i18n.t('Select at least one department.')
        case 'missing-partner-data-body':
            return i18n.t('Choose a data file to upload.')
        case 'invalid-confidence-intervals':
            return i18n.t('The selected confidence-interval option is not valid.')
        case 'invalid-reference-data-file':
        case 'invalid-reference-data-id':
        case 'reference-dataset-not-found':
            return i18n.t(
                'The selected benchmark dataset is no longer available — choose another.'
            )
        case 'unsupported-locale':
            return i18n.t('The selected report language is not available.')
        case 'mixed-mode-not-allowed':
            return i18n.t(
                'A saved reference dataset and live-fetch filters cannot be combined — clear one of them.'
            )
        case 'uploaded-data-fixes-scope':
            return i18n.t(
                'The uploaded data file already determines the department, so a department cannot be chosen as well.'
            )
        case 'invalid-parameter-value':
            return i18n.t('One of the values contains characters that are not allowed.')
        case 'unknown-validation-rule':
            return i18n.t(
                'A validation rule you selected is no longer available. Reload the page to see the current rules.'
            )
        case 'invalid-reference-data':
            return i18n.t('The uploaded file is not a valid reference dataset.')
        case 'unsupported-media-type':
            return i18n.t('The uploaded file type is not supported.')
        case 'resource-not-found':
            return i18n.t('The requested item no longer exists.')
        case 'insufficient-authority':
            return i18n.t('You do not have permission to perform this action.')
        case 'invalid-id':
            return i18n.t('The request was not valid.')
        default:
            return null
    }
}

/** Generic fallback keyed on the HTTP status class, when there is no body. */
const genericMessage = (status: number): string => {
    if (status >= 500) {
        return i18n.t(
            'Something went wrong while generating the report. Please try again.'
        )
    }
    if (status === 406) {
        return i18n.t(
            'The report is not available in the requested format or language.'
        )
    }
    return i18n.t('The request could not be completed.')
}

/**
 * Turn a thrown value into a user-facing {@link Error} with a friendly,
 * localized message. For a {@link NeoipcReportingError} carrying RFC 7807
 * `application/problem+json`, the message is chosen by the stable `code`
 * (localized, user-domain); an unmapped code falls back to the backend
 * `title`/`detail` (English), a non-JSON body to a trimmed snippet, and an
 * empty body to a generic status-class message. Non-HTTP errors keep their
 * own message. This is the single shared error-enricher for the render and
 * admin flows.
 */
export const enrichError = async (err: unknown): Promise<Error> => {
    if (!(err instanceof NeoipcReportingError)) {
        return err instanceof Error ? err : new Error(String(err))
    }

    const { status } = err.response
    const contentType = err.response.headers.get('content-type') ?? ''
    let body: ProblemBody | null = null
    if (contentType.includes('json')) {
        try {
            body = (await err.response.json()) as ProblemBody
        } catch {
            body = null
        }
    }

    if (body?.code) {
        const mapped = messageForCode(body.code)
        if (mapped) return new Error(mapped)
    }

    const parts = [body?.title, body?.detail].filter(Boolean)
    if (parts.length > 0) return new Error(parts.join(' — '))

    // Non-JSON body (rare — e.g. a bare error page): surface a trimmed snippet.
    if (!contentType.includes('json')) {
        try {
            const text = await err.response.text()
            if (text.trim()) return new Error(text.slice(0, 300))
        } catch {
            // fall through to the generic message
        }
    }

    return new Error(genericMessage(status))
}
