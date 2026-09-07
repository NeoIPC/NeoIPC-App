import { test, expect, Page } from '@playwright/test'
import { userByKey } from './users'
import { readState } from './api'
import { gotoApp, setDateField, clickGenerate } from './report-actions'

/**
 * The Reference Report's admin live-fetch filters, which no other spec reaches:
 * `reference-report.spec.ts` runs as a report-only user, for whom the whole
 * section is absent. Two of those filters are covered here.
 *
 * **Test units.** `testUnitFilter` is an *apply-the-filter* flag — its backend
 * default of `true` is what **excludes** test units — while the checkbox states
 * the outcome ("Include test data"), so checked maps to `false` and unchecked
 * omits the parameter. Nothing about that reads correctly at a glance, and the
 * defect it replaced was exactly this polarity inverted, so it is pinned here at
 * both ends. `src/api/reports.test.ts` already fixes the second half — that the
 * form value `false` reaches the wire as `testUnitFilter=false` — so what these
 * tests add is the half no unit test can reach: that the control a user actually
 * sees produces that value, and that the value drives the exclusion.
 *
 * The first test observes the exclusion **in the DOM rather than in a rendered
 * report**, which is what makes it cheap enough to assert both polarities:
 * `departmentExcludeGroups` is derived from the same `testUnitFilter` value, so
 * admitting test units changes which departments the Departments picker offers.
 * The seed provides the pair this needs — `AT_TEST_TEST2` is in `TEST_UNITS` and
 * `AT_TEST_TEST` is deliberately outside it — so a control that did nothing, and
 * one wired to the opposite value, both fail on a set of offered options rather
 * than on a number buried in a report.
 *
 * The second test binds that to the request, because "the picker changed" and
 * "the backend was told" are different claims and only one of them is what the
 * report depends on.
 *
 * Runs as superadmin: `allowNone` on the dataset select, and the live-fetch
 * section itself, are both admin-only.
 */

/**
 * Put the form into live-fetch mode with the filter section open.
 *
 * Both steps are the ones a user takes. The dataset must be `(none)` or every
 * filter renders disabled — the saved dataset fixes the cohort — and the section
 * is a collapsed disclosure whose body is not in the DOM until its toggle is
 * clicked, so the fields cannot be reached without opening it.
 *
 * A stack with no stored dataset has no picker to set: `ReferenceDataSelect`
 * renders a notice in its place, and with nothing to preselect the form is
 * already in live mode, so that branch goes straight to the toggle.
 */
const openLiveFetchFilters = async (page: Page): Promise<void> => {
    await gotoApp(page, '/reports/reference')

    // The dataset listing is loaded before the app renders at all, and the page
    // refetches it on entry; whichever of the select and the empty-listing notice
    // is on screen once that settles is final rather than interim, because no
    // other spec writes to the stack while this one runs (the suite pins one
    // worker).
    const dataset = page.locator('[data-test="referenceDataId"]')
    const noDatasets = page.getByText('No reference datasets', { exact: true })
    await expect(dataset.or(noDatasets)).toBeVisible()

    if (await dataset.isVisible()) {
        // The form preselects a saved dataset asynchronously, and a preselection
        // arriving after the override would undo it. The select's own visibility
        // does not say it has arrived: the select appears with the dataset
        // listing, and the preselection is a passive effect of that same render
        // that the select shows nothing of while it is still pending. What does
        // show it is the metadata card `ReferenceDataSelect` renders beside the
        // select, only while a dataset is selected — so the card being on screen
        // is the preselection having landed, and that is what is waited for.
        const selectedDatasetCard = page.locator(
            '[data-test="referenceDataId"] ~ [data-test="dhis2-uicore-card"]'
        )
        await expect(selectedDatasetCard).toBeVisible()

        await dataset.click()
        const portal = page.locator('#dhis2-portal-root')
        await portal.getByText('(none)', { exact: true }).click()
        // `Escape`, unconditionally, as `selectReferenceDataset` does: re-picking
        // an already-selected `@dhis2/ui` option is a no-op that leaves the menu
        // — and its click-blocking backdrop — open, which swallows the next
        // click. Escape on a closed menu does nothing, so the guard costs a
        // keystroke and does not depend on the wait above being what keeps
        // `(none)` from already being the value.
        await page.keyboard.press('Escape')
        // The pick took: the card renders for a selected dataset and for nothing
        // else, so its absence is the override having replaced the preselection.
        await expect(selectedDatasetCard).toHaveCount(0)
    }

    const toggle = page.getByRole('button', {
        name: 'Live-fetch filters (admins only)',
    })
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click()
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

/**
 * The set of department names the picker currently offers, given one name that
 * is offered whatever the exclusion does.
 *
 * The menu has to be opened to be read: `@dhis2/ui` renders its options into the
 * portal only while open, so a closed picker holds none of them and a check
 * against the collapsed control would pass whatever the exclusion did.
 *
 * `alwaysOffered` is the settled-state signal, and it is load-bearing twice
 * over. It cannot be the portal element — `#dhis2-portal-root` is a positioning
 * container with no box of its own, so it reports hidden while the menu inside
 * it is plainly on screen. And it cannot be omitted: reading the text before the
 * options render returns a string containing neither department, which would
 * report the test unit as excluded no matter what the checkbox had done.
 */
const offeredDepartments = async (
    page: Page,
    alwaysOffered: string
): Promise<string> => {
    await page.locator('[data-test="departmentFilter"]').click()
    const portal = page.locator('#dhis2-portal-root')
    await expect(
        portal.getByText(alwaysOffered, { exact: false }).first()
    ).toBeVisible()
    const text = (await portal.textContent()) ?? ''
    await page.keyboard.press('Escape')
    return text
}

test.describe('reference report — admin live-fetch filters', () => {
    test.use({ storageState: userByKey('superadmin').storageState })

    test('the test-data checkbox admits test departments, and only when checked', async ({
        page,
    }) => {
        const { orgUnitDisplayNames } = readState()
        const testUnit = orgUnitDisplayNames.AT_TEST_TEST2
        const regular = orgUnitDisplayNames.AT_TEST_TEST

        // Everything below matches these two names as substrings of the open
        // menu's text, so the whole test turns on neither containing the other.
        // Their *codes* do — `AT_TEST_TEST` is a strict prefix of `AT_TEST_TEST2`
        // — so this is a real hazard one rename away, and a seed that tripped it
        // would make the assertions pass while distinguishing nothing. State it
        // as a check rather than as an assumption.
        expect(testUnit).not.toContain(regular)
        expect(regular).not.toContain(testUnit)

        await openLiveFetchFilters(page)

        const checkbox = page.locator('input[name="testUnitFilter"]')
        await expect(checkbox).not.toBeChecked()

        // Unchecked is the exclusion, so the test unit is not on offer while the
        // regular department is. Asserting both ways round is what separates
        // "excluded" from "the picker is empty".
        let offered = await offeredDepartments(page, regular)
        expect(offered).toContain(regular)
        expect(offered).not.toContain(testUnit)

        await checkbox.check()
        offered = await offeredDepartments(page, regular)
        expect(offered).toContain(regular)
        expect(offered).toContain(testUnit)

        // And back, because a control that only ever adds would pass the step
        // above while being incapable of excluding anything.
        await checkbox.uncheck()
        offered = await offeredDepartments(page, regular)
        expect(offered).toContain(regular)
        expect(offered).not.toContain(testUnit)
    })

    test('the live-fetch filters reach the request', async ({ page }) => {
        const { orgUnitDisplayNames } = readState()

        await openLiveFetchFilters(page)
        await page.locator('input[name="testUnitFilter"]').check()

        await page.locator('[data-test="departmentFilter"]').click()
        await page
            .locator('#dhis2-portal-root')
            .getByText(orgUnitDisplayNames.AT_TEST_TEST, { exact: false })
            .first()
            .click()
        await page.keyboard.press('Escape')

        // A two-day window keeps the live fetch this submission triggers small.
        // The assertion is on the request, so the render's result is not needed —
        // but it still runs on the instance, and there is no reason to make it
        // compute a decade of data to prove what the query string says.
        await setDateField(page, 'reportingPeriodFrom', '2020-01-01')
        await setDateField(page, 'reportingPeriodTo', '2020-01-02')

        const request = await Promise.all([
            // Anchored on the path, not a substring of the URL: the same origin
            // also serves GET /reference-report/presets and /reference-report/locales,
            // which a substring match would accept as the render request.
            page.waitForRequest(
                (req) =>
                    new URL(req.url()).pathname.endsWith('/reference-report') &&
                    req.method() === 'GET'
            ),
            clickGenerate(page),
        ]).then(([req]) => req)

        const qs = new URL(request.url()).searchParams
        // `false` is the whole point: this flag applies the exclusion, so `true`
        // here would mean the checkbox labelled "Include test data" had asked the
        // backend to leave test data out.
        expect(qs.get('testUnitFilter')).toBe('false')
        // Exact membership, because `AT_TEST_TEST` is a strict PREFIX of
        // `AT_TEST_TEST2` — and the box was just checked, so the test unit is on
        // offer at the moment of the click. A substring check over the joined
        // values would be satisfied by either department, which is precisely the
        // distinction this spec exists to make. `appendArray` appends one entry
        // per code, so `getAll` is already the exact list the request carried.
        expect(qs.getAll('departmentFilter')).toEqual(['AT_TEST_TEST'])
    })
})
