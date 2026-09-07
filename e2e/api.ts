import fs from 'node:fs'
import path from 'node:path'
import type { APIRequestContext } from '@playwright/test'
import { TEST_UNITS_GROUP_CODE } from '../src/config/dhis2Constants'
import { AUTH_DIR } from './users'

/**
 * App name from `d2.config.js`; installed custom apps are served here.
 * Case-sensitive: DHIS2 compares the path segment against the app's key with
 * `equals`, so `/api/apps/neoipc/…` is a 404 while `/api/apps/NeoIPC/…` is not.
 */
export const APP_NAME = 'NeoIPC'
export const APP_INDEX = `/api/apps/${APP_NAME}/index.html`

/** Build an in-app URL: the installed bundle plus a HashRouter route. */
export const appUrl = (hashRoute: string): string => `${APP_INDEX}#${hashRoute}`

/** NeoIPC-Reporting mount (see `src/config/dhis2Constants.ts` `NEOIPC_REPORTING_BASE`). */
export const NEOIPC_BASE = '/neoipc/api'

/** Committed fixtures under `e2e/fixtures/` (see `e2e/fixtures/README.md`). */
export const FIXTURES_DIR = path.join(__dirname, 'fixtures')
export const REFERENCE_DATA_FIXTURE = path.join(FIXTURES_DIR, 'reference-data.json')
/**
 * A second, byte-distinct-but-valid reference dataset (a copy of
 * `reference-data.json` with one metadata count bumped). The reporting service
 * dedups identical content, so the admin-CRUD upload path needs a dataset that
 * is *not* the one the seed / global setup already stored — otherwise the upload
 * would 409 (which the dedicated duplicate-rejection test asserts on purpose).
 */
export const REFERENCE_DATA_CRUD_FIXTURE = path.join(
    FIXTURES_DIR,
    'reference-data-crud.json'
)
export const PARTNER_DATA_FIXTURE = path.join(FIXTURES_DIR, 'partner-data.json')
export const VALIDATION_EXCEPTIONS_FIXTURE = path.join(
    FIXTURES_DIR,
    'validation-exceptions.csv'
)

/**
 * True if a fixture is still the committed placeholder rather than a real
 * captured dataset. The reference/partner data files must be captured from a
 * seeded stack (their upload derives metadata from the content), so the specs
 * that consume them skip until a real fixture is dropped in — see
 * `e2e/fixtures/README.md`.
 */
export function isPlaceholderFixture(filePath: string): boolean {
    try {
        return fs.readFileSync(filePath, 'utf8').includes('__placeholder__')
    } catch {
        return true
    }
}

const STATE_FILE = path.join(AUTH_DIR, 'state.json')

/** Cross-run state written by global setup and read by the specs. */
export interface E2EState {
    /**
     * The reference dataset reference-report.spec renders. Global setup uploads
     * `reference-data.json` whenever the fixture is real: a 201 means it stored it
     * (`owned: true` — teardown deletes it), a 409 means those exact bytes were
     * already stored and the first listed dataset is reused (`owned: false` —
     * teardown leaves it). `null` whenever the fixture is a placeholder, whatever
     * the stack holds.
     */
    referenceFixture: { id: string; displayName: string; owned: boolean } | null
    /** displayName of each seeded department, by org-unit code (for the picker spec). */
    orgUnitDisplayNames: Record<string, string>
}

export const writeState = (state: E2EState): void => {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export const readState = (): E2EState =>
    JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as E2EState

const ensureOk = async (
    res: { ok(): boolean; status(): number; text(): Promise<string> },
    what: string
): Promise<void> => {
    if (!res.ok()) {
        throw new Error(`${what} failed: HTTP ${res.status()} — ${await res.text()}`)
    }
}

/**
 * Install the built app bundle into DHIS2 (`POST /api/apps`, multipart field
 * `file`), then assert it is served. Reuses the bundle the runner built — this
 * does not re-run `yarn build`.
 */
export async function installApp(
    ctx: APIRequestContext,
    bundlePath: string
): Promise<void> {
    if (!fs.existsSync(bundlePath)) {
        throw new Error(
            `app bundle not found: ${bundlePath} — run 'yarn build' (or Invoke-PlaywrightTests.ps1 without -SkipAppBuild)`
        )
    }
    const res = await ctx.post('/api/apps', {
        multipart: {
            file: {
                name: path.basename(bundlePath),
                mimeType: 'application/zip',
                buffer: fs.readFileSync(bundlePath),
            },
        },
    })
    await ensureOk(res, 'app install (POST /api/apps)')
    const served = await ctx.get(APP_INDEX)
    await ensureOk(served, `app served (GET ${APP_INDEX})`)
}

/**
 * Fail fast if the play seed is absent — the suite asserts the seed exists but
 * does not create it (seeding stays in `Initialize-TestDhis2.ps1`).
 */
export async function assertSeeded(ctx: APIRequestContext): Promise<void> {
    // AT_TEST_TEST2 is as required as the other two: the reference-report
    // live-fetch spec needs a department inside TEST_UNITS to observe the
    // exclusion admitting one, and global setup reads its display name. The
    // seeder's -TestUnitDepartmentCodes accepts an empty list, so a stack
    // without it is a reachable configuration — and without this check the
    // failure is a bare lookup error in setup that names neither the seeder
    // nor the flag, and takes every spec on every engine down with it.
    // The specs depend on TEST_UNITS *membership*, not merely on the departments
    // existing, and each code is wanted in its state for a reason of its own,
    // so the reason travels with the expectation into the failure message.
    // Existence and membership fail differently and both are checked here,
    // because a stack where AT_TEST_TEST2 exists outside the group — or where
    // AT_TEST_TEST or CH_TEST_TEST has been added to it — passes an existence
    // check and then fails inside a spec on an option list or a collapsed
    // picker, naming neither the group nor the seeder. That two of the three
    // dependencies are on a property being *absent* is exactly the kind nothing
    // greps for, so they are asserted rather than assumed.
    const partnerPickerDefault =
        'the Partner Report form drops TEST_UNITS members from its department picker unless "Include test data" is checked'
    const wantTestUnit: Record<string, { testUnit: boolean; because: string }> = {
        AT_TEST_TEST: {
            testUnit: false,
            because: `${partnerPickerDefault}, and the org-unit-picker and partner-report specs reach AT_TEST_TEST through it; the reference-report live-fetch spec also reads the exclusion by AT_TEST_TEST staying on offer`,
        },
        AT_TEST_TEST2: {
            testUnit: true,
            because: 'the reference-report live-fetch spec needs a TEST_UNITS member that "Include test data" admits to the Departments picker',
        },
        CH_TEST_TEST: {
            testUnit: false,
            because: `${partnerPickerDefault}, and the org-unit-picker spec reaches CH_TEST_TEST through it as the CH report user`,
        },
    }
    for (const [code, { testUnit: shouldBeTestUnit, because }] of Object.entries(
        wantTestUnit
    )) {
        const res = await ctx.get('/api/organisationUnits', {
            params: {
                filter: `code:eq:${code}`,
                fields: 'id,organisationUnitGroups[code]',
            },
        })
        await ensureOk(res, `seed check (org unit ${code})`)
        // `code` is nullable on a group, as `src/forms/fields/orgUnits.ts` types
        // it: a group without one is simply not the group being looked for.
        const body = (await res.json()) as {
            organisationUnits?: {
                organisationUnitGroups?: { code: string | null }[]
            }[]
        }
        const unit = body.organisationUnits?.[0]
        if (!unit) {
            throw new Error(
                `seed missing: no org unit with code ${code}. Seed the stack with Initialize-TestDhis2.ps1 first.`
            )
        }
        const isTestUnit = (unit.organisationUnitGroups ?? []).some(
            (g) => g.code === TEST_UNITS_GROUP_CODE
        )
        if (isTestUnit !== shouldBeTestUnit) {
            throw new Error(
                `seed shape wrong: ${code} is ${isTestUnit ? '' : 'not '}in the ${TEST_UNITS_GROUP_CODE} group, but it must be ${shouldBeTestUnit ? 'in' : 'out of'} that group: ${because}. Re-seed with Initialize-TestDhis2.ps1 (its -TestUnitDepartmentCodes controls this).`
            )
        }
    }
    for (const username of ['play.at.report1', 'play.ch.report1']) {
        const res = await ctx.get('/api/users', {
            params: { filter: `username:eq:${username}`, fields: 'id' },
        })
        await ensureOk(res, `seed check (user ${username})`)
        const body = (await res.json()) as { users?: unknown[] }
        if (!body.users?.length) {
            throw new Error(
                `seed missing: report user ${username} not found. Re-seed with the updated play package.`
            )
        }
    }
}

/** Resolve an org unit's displayName by its code (metadata read; not a privacy boundary). */
export async function orgUnitDisplayName(
    ctx: APIRequestContext,
    code: string
): Promise<string> {
    const res = await ctx.get('/api/organisationUnits', {
        params: { filter: `code:eq:${code}`, fields: 'displayName' },
    })
    await ensureOk(res, `org unit lookup (${code})`)
    const body = (await res.json()) as {
        organisationUnits?: { displayName: string }[]
    }
    const displayName = body.organisationUnits?.[0]?.displayName
    if (!displayName) throw new Error(`org unit not found by code: ${code}`)
    return displayName
}

/** List the saved reference datasets (public listing: `GET {NEOIPC_BASE}/reference-data`). */
export async function listReferenceData(
    ctx: APIRequestContext
): Promise<{ id: string; displayName: string }[]> {
    const res = await ctx.get(`${NEOIPC_BASE}/reference-data`)
    await ensureOk(res, 'reference-data listing')
    return (await res.json()) as { id: string; displayName: string }[]
}

/** Delete a reference dataset by id (best-effort teardown). */
export async function deleteReferenceData(
    ctx: APIRequestContext,
    id: string
): Promise<void> {
    await ctx.delete(`${NEOIPC_BASE}/admin/reference-data/${encodeURIComponent(id)}`)
}

/** Set the current user's DHIS2 UI locale (`POST /api/userSettings/keyUiLocale?value=`). */
export async function setUiLocale(
    ctx: APIRequestContext,
    locale: string
): Promise<void> {
    const res = await ctx.post('/api/userSettings/keyUiLocale', {
        params: { value: locale },
    })
    await ensureOk(res, `set keyUiLocale=${locale}`)
}

/** Clear the current user's DHIS2 UI locale, restoring the instance default. */
export async function clearUiLocale(ctx: APIRequestContext): Promise<void> {
    const res = await ctx.delete('/api/userSettings/keyUiLocale')
    await ensureOk(res, 'clear keyUiLocale')
}
