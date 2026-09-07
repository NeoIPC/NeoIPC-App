import { request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { dhis2Login } from './dhis2-login'
import {
    NEOIPC_BASE,
    installApp,
    assertSeeded,
    orgUnitDisplayName,
    listReferenceData,
    writeState,
    isPlaceholderFixture,
    REFERENCE_DATA_FIXTURE,
    type E2EState,
} from './api'

/**
 * One-time, engine-independent setup, run once before all projects:
 *  1. install the built app bundle into DHIS2;
 *  2. assert the play seed (departments + report users) is present;
 *  3. resolve seeded department displayNames for the picker spec;
 *  4. ensure reference-data.json's content is stored (upload it; reuse an existing
 *     dataset on a 409) for reference-report.spec + the admin-crud dedup 409 test.
 *
 * All of it runs under one DHIS2 admin session. The DHIS2 root superuser
 * (`ALL`) satisfies both NeoIPC authority tiers (see NeoIPC-Reporting
 * `Program.cs`), so the same session installs the app *and* uploads via the
 * `F_NEOIPC_ADMIN`-gated `/neoipc` admin endpoint.
 */
async function globalSetup(): Promise<void> {
    const baseURL = process.env.DHIS2_BASE_URL ?? 'http://localhost:8080'

    // Safety gate: the suite mutates DHIS2 state (installs the app bundle,
    // uploads/deletes reference data, CRUDs the validation-exceptions singleton)
    // with default synthetic/demo credentials. Refuse a non-local target unless
    // explicitly opted in, so an errant DHIS2_BASE_URL can't drive destructive
    // setup against a shared or production stack.
    const { hostname } = new URL(baseURL)
    const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]'
    if (!isLocal && process.env.E2E_ALLOW_NONLOCAL !== 'true') {
        throw new Error(
            `Refusing to run the e2e suite against non-local DHIS2_BASE_URL ` +
                `"${baseURL}": it mutates state with default synthetic ` +
                `credentials. Set E2E_ALLOW_NONLOCAL=true to override.`
        )
    }

    const adminUser = process.env.DHIS2_ADMIN_USER ?? 'admin'
    const adminPass = process.env.DHIS2_ADMIN_PASS ?? 'district'

    const ctx = await dhis2Login(request, baseURL, adminUser, adminPass)
    try {
        const appDir = path.resolve(__dirname, '..')
        // The archive is named from the d2 config, not from package.json —
        // those disagree here, since the package is `neoipc-app` while the app
        // is `NeoIPC`. Read the manifest the build wrote rather than
        // reconstructing the name from the wrong source.
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(appDir, 'build', 'app', 'manifest.webapp'),
                'utf8'
            )
        ) as { short_name: string; version: string }
        const bundlePath = path.join(
            appDir,
            'build',
            'bundle',
            `${manifest.short_name}-${manifest.version}.zip`
        )
        await installApp(ctx, bundlePath)

        await assertSeeded(ctx)

        // AT_TEST_TEST2 is one of the seed's TEST_UNITS members, and AT_TEST_TEST is
        // deliberately outside that group. The pair is what lets a spec observe a
        // test-unit exclusion changing which departments are offered: one department
        // is admitted by the toggle and one is present either way.
        const orgUnitDisplayNames = {
            AT_TEST_TEST: await orgUnitDisplayName(ctx, 'AT_TEST_TEST'),
            AT_TEST_TEST2: await orgUnitDisplayName(ctx, 'AT_TEST_TEST2'),
            CH_TEST_TEST: await orgUnitDisplayName(ctx, 'CH_TEST_TEST'),
        }

        // Ensure `reference-data.json`'s content is stored: reference-report.spec
        // renders a saved dataset, and the admin-crud 409 test relies on those
        // exact bytes already being present. Upload it — a 409 means those bytes are
        // already stored, by the seed or by a run whose teardown never ran, so reuse
        // the first listed dataset for the render spec (owned:false, teardown leaves
        // it); a 201 means we stored it (owned:true, teardown deletes it). Skip only
        // when the fixture is still a placeholder (reference-report.spec then skips —
        // see e2e/fixtures/README.md).
        let referenceFixture: E2EState['referenceFixture'] = null
        if (!isPlaceholderFixture(REFERENCE_DATA_FIXTURE)) {
            const displayName = `e2e-reference-${Date.now().toString(36)}`
            const res = await ctx.post(`${NEOIPC_BASE}/admin/reference-data`, {
                params: { displayName },
                headers: { 'Content-Type': 'application/json' },
                data: fs.readFileSync(REFERENCE_DATA_FIXTURE),
            })
            if (res.status() === 201) {
                const { id } = (await res.json()) as { id: string }
                referenceFixture = { id, displayName, owned: true }
            } else if (res.status() === 409) {
                const existing = await listReferenceData(ctx)
                if (existing.length > 0) {
                    referenceFixture = {
                        id: existing[0].id,
                        displayName: existing[0].displayName,
                        owned: false,
                    }
                }
            } else {
                throw new Error(
                    `reference-data upload failed: HTTP ${res.status()} — ${await res.text()}`
                )
            }
        }

        writeState({ referenceFixture, orgUnitDisplayNames })
    } finally {
        await ctx.dispose()
    }
}

export default globalSetup
