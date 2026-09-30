import { test, expect } from '@playwright/test'
import { userByKey } from './users'
import { readState } from './api'
import {
    gotoApp,
    setOutputFormat,
    selectDepartment,
    clickGenerate,
    expectRenderedReport,
    expectDownload,
} from './report-actions'

/**
 * Validation Report: HTML output mounts the inline report fragment, PDF output
 * triggers a blob download, and the per-rule toggles reach the request. Runs
 * as the AT report user against the synthetic patients seeded into
 * AT_TEST_TEST, a department outside the test-unit group, so the picker offers
 * it without "Include test data".
 */
/** The department picker on this form: an optional filter, which never collapses. */
const DEPARTMENT_PICKER = { fieldName: 'departmentFilter', collapses: false }

test.describe('validation report', () => {
    test.use({ storageState: userByKey('atReport').storageState })

    test('HTML output renders the report for the seeded department', async ({
        page,
    }) => {
        const { orgUnitDisplayNames } = readState()
        await gotoApp(page, '/reports/validation')
        await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST, DEPARTMENT_PICKER)
        await setOutputFormat(page, 'html')

        const [request] = await Promise.all([
            page.waitForRequest(
                (req) => req.url().includes('/validation-report?') && req.method() === 'GET'
            ),
            clickGenerate(page),
        ])
        const qs = new URL(request.url()).searchParams
        // Exact membership, because `AT_TEST_TEST` is a strict prefix of
        // `AT_TEST_TEST2`: a substring check would also pass for the wrong
        // department, or for a request carrying both.
        expect(qs.getAll('departmentFilter')).toEqual(['AT_TEST_TEST'])
        // Every rule is selected, which the request leaves to the report.
        expect(qs.has('rules')).toBe(false)

        const report = await expectRenderedReport(page)
        // The header names the rules the document rests on.
        await expect(report).toContainText(/All \d+ rules/)

        // The report scrolls in the content pane, whose scrollbar reaches the
        // report's end only while the pane ends at the window's lower edge,
        // and its screenshots are scaled to its width rather than widening it.
        const paneBottom = await page
            .locator('main')
            .evaluate((main) => main.getBoundingClientRect().bottom)
        expect(paneBottom).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight))
        // An image not yet decoded measures 0 wide and would fit trivially.
        await report
            .locator('img')
            .evaluateAll((images) =>
                Promise.all(images.map((image) => (image as HTMLImageElement).decode()))
            )
        const imagesFit = await report.evaluate((container) => {
            const width = container.getBoundingClientRect().width
            return Array.from(container.querySelectorAll('img')).map(
                (image) => image.getBoundingClientRect().width <= width
            )
        })
        expect(imagesFit.length, 'the seeded finding shows a screenshot').toBeGreaterThan(0)
        expect(imagesFit.every(Boolean)).toBe(true)

        // The seeded department's one open enrolment, E2E-TC-FIXTURE's, has no
        // Surveillance-End form and is older than the 120 days rule 43 allows,
        // so the report lists it with a reference to the problem's details.
        const reference = report.locator('a[href^="#sec-problem-details-"]').first()
        await expect(
            reference,
            'AT_TEST_TEST needs a validation finding: the rule-43 enrolment of E2E-TC-FIXTURE'
        ).toBeAttached()

        // Following the reference leaves the URL alone (the app routes on its
        // fragment) and hands the focus to the details, which only the app's
        // handler does: the browser's own fragment navigation would leave it
        // on the page. That the details are in view afterwards holds whether
        // or not they had to be scrolled to.
        const detailsId = ((await reference.getAttribute('href')) ?? '#').slice(1)
        const url = page.url()
        await reference.click()
        const details = report.locator(`[id="${detailsId}"]`)
        await expect(details).toBeFocused()
        await expect(details).toBeInViewport()
        expect(page.url()).toBe(url)

        // Each patient links to its Tracker Capture dashboard on the DHIS2 the
        // browser reaches, not the address the service reads from, in a new
        // tab so the report stays on screen.
        const dashboards = report.locator('a[href*="/dhis-web-tracker-capture/"]')
        await expect(dashboards.first()).toBeVisible()
        const origin = new URL(page.url()).origin
        for (const link of await dashboards.all()) {
            expect(new URL((await link.getAttribute('href')) ?? '').origin).toBe(origin)
            await expect(link).toHaveAttribute('target', '_blank')
        }
    })

    test('PDF output triggers a PDF download', async ({ page }) => {
        const { orgUnitDisplayNames } = readState()
        await gotoApp(page, '/reports/validation')
        await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST, DEPARTMENT_PICKER)
        await setOutputFormat(page, 'pdf')

        const download = await expectDownload(page, () => clickGenerate(page))
        expect(download.suggestedFilename()).toMatch(
            /^NeoIPC-Surveillance-Validation-Report_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/
        )
    })

    test('an unchecked rule is left out of the request', async ({ page }) => {
        const { orgUnitDisplayNames } = readState()
        await gotoApp(page, '/reports/validation')
        await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST, DEPARTMENT_PICKER)
        await setOutputFormat(page, 'html')

        await page.getByRole('button', { name: 'More options' }).click()
        const ruleBoxes = page.locator('input[type="checkbox"][name^="rule-"]')
        await expect(ruleBoxes.first()).toBeVisible()
        const count = await ruleBoxes.count()
        expect(count).toBeGreaterThan(1)
        for (let i = 0; i < count; i++) {
            await expect(ruleBoxes.nth(i)).toBeChecked()
        }

        await page.locator('input[name="rule-25"]').uncheck()

        const [request] = await Promise.all([
            page.waitForRequest(
                (req) => req.url().includes('/validation-report?') && req.method() === 'GET'
            ),
            clickGenerate(page),
        ])
        const rules = new URL(request.url()).searchParams.getAll('rules')
        expect(rules).toHaveLength(count - 1)
        expect(rules).not.toContain('25')
        await expectRenderedReport(page)
    })
})
