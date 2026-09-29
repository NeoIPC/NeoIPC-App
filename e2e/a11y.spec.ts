import { expect, test, type Page } from '@playwright/test'
import { userByKey } from './users'
import { gotoApp } from './report-actions'
import { expectNoNewA11yViolations } from './a11y'

/**
 * Accessibility gate: axe-core (WCAG 2.1 A + AA) over the app's main routes, per
 * persona (routes are authority-scoped, so the admin covers the admin views the
 * report user cannot reach). Fails only on violations not in the triaged vendor
 * baseline (see `e2e/a11y.ts` + `a11y-baseline.json`), so it catches regressions
 * in the app's own markup without drowning in `@dhis2/ui` vendor noise.
 */

/**
 * Bring the route's own content into the DOM before auditing it.
 *
 * Two things would otherwise be scanned and found clean without ever having been
 * rendered. `gotoApp` waits on a left-nav menu item, but the nav commits in the
 * same render as the content pane, whose pages are lazy behind a `<Suspense>`
 * fallback — so the audit could run against the loading spinner. And
 * `CollapsibleSection` renders `{open && children}`, so a collapsed section's
 * subtree is genuinely absent from the DOM rather than hidden; every section
 * starts collapsed, which would leave the bulk of the report forms unaudited.
 * A section can also hold a loader of its own, so what an expansion reveals is
 * waited on as well as what the route paints first.
 */
async function revealRouteContent(page: Page): Promise<void> {
    // The routed page owns the only <h1>; the shell chrome has none.
    await expect(page.locator('main h1').first()).toBeVisible()

    // The <h1> can paint in the same commit that starts the page's data fetch, so
    // it alone does not mean the pane is populated — on the admin routes, which
    // have no disclosures for the loop below to wait on, it would be the only
    // barrier. Both admin pages render a CircularLoader while their data is in
    // flight, so its absence is the settle that makes their coverage as real as
    // the report routes'.
    const loaders = page.locator('main [data-test="dhis2-uicore-circularloader"]')
    await expect(loaders).toHaveCount(0)

    // Expand every collapsed disclosure, re-querying each pass because expanding
    // one section can reveal another nested inside it. Each click expands exactly
    // one, so waiting for the expanded count to rise settles the DOM before the
    // next pass — and bounds the loop against a control that never flips.
    const collapsed = page.locator('main button[aria-expanded="false"]')
    const expanded = page.locator('main button[aria-expanded="true"]')
    for (let guard = 0; guard < 25; guard++) {
        if ((await collapsed.count()) === 0) break
        const expandedBefore = await expanded.count()
        await collapsed.first().click()
        await expect(expanded).toHaveCount(expandedBefore + 1)
    }
    await expect(collapsed).toHaveCount(0)

    // The check above cannot see a loader inside a section that was still
    // collapsed: the Validation Report fetches its rule list when the form
    // mounts, but the list and its loader live in "More options". Settle again
    // on what the expansion revealed, so the audit scans the rules rather than
    // their spinner.
    await expect(loaders).toHaveCount(0)
}

test.describe('accessibility — axe / WCAG 2.1 AA', () => {
    // axe evaluates the rendered DOM, which is identical across the three engine
    // cores — so run these once (chromium) rather than redundantly per engine.
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'a11y is engine-independent; runs once on chromium'
    )

    test.describe('report user (play.at.report1)', () => {
        test.use({ storageState: userByKey('atReport').storageState })
        for (const route of [
            '/reports/partner',
            '/reports/reference',
            '/reports/validation',
        ]) {
            test(`no new violations: ${route}`, async ({ page }, testInfo) => {
                await gotoApp(page, route)
                await revealRouteContent(page)
                await expectNoNewA11yViolations(page, testInfo, route)
            })
        }
    })

    test.describe('admin user (play.admin)', () => {
        test.use({ storageState: userByKey('superadmin').storageState })
        for (const route of [
            '/reports/partner',
            '/reports/reference',
            '/reports/validation',
            '/admin/reference-data',
            '/admin/validation-exceptions',
        ]) {
            test(`no new violations: ${route}`, async ({ page }, testInfo) => {
                await gotoApp(page, route)
                await revealRouteContent(page)
                await expectNoNewA11yViolations(page, testInfo, route)
            })
        }
    })
})
