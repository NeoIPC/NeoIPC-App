import { NeoipcReportingError } from './neoipcReporting'
import { enrichError } from './problemDetails'

const makeError = (
    status: number,
    body: unknown,
    contentType = 'application/problem+json'
): NeoipcReportingError => {
    const response = {
        status,
        statusText: '',
        headers: {
            get: (h: string) =>
                h === 'content-type' ? contentType : null,
        },
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : ''),
    } as unknown as Response
    return new NeoipcReportingError(response)
}

describe('enrichError', () => {
    it('maps a known code to a friendly, user-domain message', async () => {
        const err = await enrichError(
            makeError(400, { code: 'missing-unit-codes' })
        )
        expect(err.message).toBe('Select at least one department.')
    })

    // The two mode-conflict codes must not collapse into one message. A mapped
    // code wins over the server's own `detail`, so a shared code would state the
    // wrong cause with full confidence — naming a reference dataset the user
    // never chose when what they actually did was pick a department alongside an
    // upload.
    it('distinguishes the two mode-conflict codes', async () => {
        const reference = await enrichError(
            makeError(400, { code: 'mixed-mode-not-allowed' })
        )
        const upload = await enrichError(
            makeError(400, { code: 'uploaded-data-fixes-scope' })
        )

        expect(reference.message).toContain('reference dataset')
        expect(upload.message).toContain('data file')
        expect(upload.message).not.toBe(reference.message)
    })

    it('names the control for a stale/invalid benchmark dataset', async () => {
        const err = await enrichError(
            makeError(404, { code: 'reference-dataset-not-found' })
        )
        expect(err.message).toContain('benchmark dataset')
    })

    // The service's own detail names an API route and is English only; the
    // form offers only the ids it fetched, so the cause is a rule list that
    // changed while the page was open, which a reload settles.
    it('asks for a reload when a selected validation rule is no longer known', async () => {
        const err = await enrichError(
            makeError(400, {
                code: 'unknown-validation-rule',
                title: 'Unknown validation rule',
                detail: 'The Validation Report has no rule 99; GET /validation-report/rules lists the rules it applies.',
            })
        )
        expect(err.message).toBe(
            'A validation rule you selected is no longer available. Reload the page to see the current rules.'
        )
    })

    // The service's detail is neoipcr's reason for refusing the file, the only
    // place that says what to correct; it reaches the user as written, its
    // quotation marks and line breaks included.
    it('keeps the reason a validation-exception list was refused for', async () => {
        const reason =
            'The validation exception file "list.csv" does not hold exception records.\n✖ Missing column: DEPARTMENT_CODE.'
        const err = await enrichError(
            makeError(400, {
                code: 'invalid-validation-exceptions',
                title: 'Invalid validation exceptions',
                detail: reason,
            })
        )
        expect(err.message).toBe(`The validation exception list was not stored — ${reason}`)
    })

    // i18next reads an interpolated value again for placeholders and nesting,
    // so a reason quoting a display name or a cell that looks like one would
    // lose it, or repeat the reason in its place.
    it('keeps a reason that holds placeholder or nesting syntax as written', async () => {
        const reason =
            'The validation exception file "{{reason}} $t(Upload)" does not hold exception records.\n✖ `ENROLMENT_DATE` holds 1 value that cannot be read as a date: {{x}}.'
        const err = await enrichError(
            makeError(400, {
                code: 'invalid-validation-exceptions',
                title: 'Invalid validation exceptions',
                detail: reason,
            })
        )
        expect(err.message).toBe(`The validation exception list was not stored — ${reason}`)
    })

    it('says a refused list is not valid when the service gives no reason', async () => {
        const err = await enrichError(
            makeError(400, {
                code: 'invalid-validation-exceptions',
                title: 'Invalid validation exceptions',
            })
        )
        expect(err.message).toBe(
            'The validation exception list was not stored, because it is not valid.'
        )
    })

    it('asks for a reload when the DHIS2 session has ended', async () => {
        const err = await enrichError(
            makeError(401, {
                code: 'missing-dhis2-session',
                title: 'Missing DHIS2 session',
                detail: 'The request carries no DHIS2 session cookie.',
            })
        )
        expect(err.message).toBe('Your DHIS2 session has ended. Reload the page to sign in again.')
    })

    it('prefers the mapped message over the backend title/detail', async () => {
        const err = await enrichError(
            makeError(400, {
                code: 'missing-unit-codes',
                title: 'Missing unitCodes',
                detail: "The 'unitCodes' query parameter is required.",
            })
        )
        expect(err.message).toBe('Select at least one department.')
    })

    it('falls back to title/detail for an unmapped code', async () => {
        const err = await enrichError(
            makeError(400, { code: 'some-future-code', title: 'Odd', detail: 'thing' })
        )
        expect(err.message).toBe('Odd — thing')
    })

    it('falls back to title/detail when there is no code', async () => {
        const err = await enrichError(
            makeError(400, {
                title: 'Invalid period',
                detail: 'from is after to',
            })
        )
        expect(err.message).toBe('Invalid period — from is after to')
    })

    it('uses a generic render message for an empty 500 body', async () => {
        const err = await enrichError(makeError(500, {}))
        expect(err.message).toMatch(/generating the report/i)
    })

    it('surfaces a trimmed non-JSON text body', async () => {
        const err = await enrichError(makeError(500, 'boom text', 'text/plain'))
        expect(err.message).toBe('boom text')
    })

    it('passes a non-reporting error through unchanged', async () => {
        const err = await enrichError(new Error('network down'))
        expect(err.message).toBe('network down')
    })
})
