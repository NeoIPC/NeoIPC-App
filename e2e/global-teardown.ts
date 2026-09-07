import { request } from '@playwright/test'
import { dhis2Login } from './dhis2-login'
import { deleteReferenceData, readState } from './api'

/**
 * Delete the reference-dataset fixture that global setup uploaded. Best-effort:
 * a missing state file (setup never completed) or an already-gone fixture must
 * not fail the run. A dataset global setup *reused* rather than uploaded
 * (`owned:false` — the first dataset the listing returned, reused because those
 * bytes were already stored) is left in place.
 */
async function globalTeardown(): Promise<void> {
    let fixtureId: string
    try {
        const fixture = readState().referenceFixture
        if (!fixture || !fixture.owned) return
        fixtureId = fixture.id
    } catch {
        return
    }

    const baseURL = process.env.DHIS2_BASE_URL ?? 'http://localhost:8080'
    const adminUser = process.env.DHIS2_ADMIN_USER ?? 'admin'
    const adminPass = process.env.DHIS2_ADMIN_PASS ?? 'district'

    const ctx = await dhis2Login(request, baseURL, adminUser, adminPass)
    try {
        await deleteReferenceData(ctx, fixtureId)
    } finally {
        await ctx.dispose()
    }
}

export default globalTeardown
