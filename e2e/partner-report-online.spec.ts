import { test, expect } from '@playwright/test'
import { userByKey } from './users'
import { readState } from './api'
import {
    gotoApp,
    setDataSource,
    setOutputFormat,
    setDateField,
    selectDepartment,
    clickGenerate,
    expectRenderedReport,
    expectDownload,
} from './report-actions'

/**
 * Partner report, online mode (pulls current DHIS2 data): HTML output mounts the
 * inline Quarto fragment; PDF output triggers a blob download. Runs as the AT
 * report user against synthetic patients seeded into AT_TEST_TEST.
 *
 * The reporting period spans 2020–2030 so it overlaps the seeded events. Dates
 * go through setDateField (fill + blur), since CalendarInput commits to form
 * state only on blur; each spec asserts the render request URL carries the
 * period, so a silently-dropped period filter fails the test rather than passing
 * on the backend's default window.
 */
test.describe('partner report — online mode', () => {
    test.use({ storageState: userByKey('atReport').storageState })

    test('HTML output mounts an inline report fragment with a table', async ({
        page,
    }) => {
        const { orgUnitDisplayNames } = readState()
        await gotoApp(page, '/reports/partner')
        await setDataSource(page, 'online')
        await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST)
        await setDateField(page, 'reportingPeriodFrom', '2020-01-01')
        await setDateField(page, 'reportingPeriodTo', '2030-12-31')
        await setOutputFormat(page, 'html')

        // The period must reach the backend: it is appended to the query string
        // only when non-empty (buildPartnerReportQuery), so a value that never
        // committed to form state disappears from the request entirely. Observe
        // the request and the click together so neither promise is left unobserved
        // if the other rejects.
        const [request] = await Promise.all([
            page.waitForRequest(
                (req) =>
                    req.url().includes('/partner-report') &&
                    req.method() === 'GET'
            ),
            clickGenerate(page),
        ])
        expect(request.url()).toContain('reportingPeriodFrom=2020-01-01')
        expect(request.url()).toContain('reportingPeriodTo=2030-12-31')

        const report = await expectRenderedReport(page)
        await expect(report.locator('table').first()).toBeVisible()
        // The data-validation summary is the first section after the header,
        // and the form asks for it by default.
        expect(request.url()).toContain('includeValidationSummaryTable=true')
        await expect(
            report.getByRole('heading', { name: 'Data Validation' })
        ).toBeVisible()
    })

    test('PDF output triggers a PDF download', async ({ page }) => {
        const { orgUnitDisplayNames } = readState()
        await gotoApp(page, '/reports/partner')
        await setDataSource(page, 'online')
        await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST)
        await setDateField(page, 'reportingPeriodFrom', '2020-01-01')
        await setDateField(page, 'reportingPeriodTo', '2030-12-31')
        await setOutputFormat(page, 'pdf')

        // Same period round-trip guarantee as the HTML spec (see there). Await the
        // request and the download together so a failure in one doesn't leave the
        // other's promise unobserved (an unhandled rejection after the test ends).
        const [request, download] = await Promise.all([
            page.waitForRequest(
                (req) =>
                    req.url().includes('/partner-report') &&
                    req.method() === 'GET'
            ),
            expectDownload(page, () => clickGenerate(page)),
        ])
        expect(request.url()).toContain('reportingPeriodFrom=2020-01-01')
        expect(request.url()).toContain('reportingPeriodTo=2030-12-31')
        // Backend Content-Disposition: NeoIPC-Surveillance-<report>_<yyyy-MM-dd_HH-mm-ss>.pdf
        // (ExternalProcessReportProducer.GetFileDownloadName) — not the app's fallback name.
        expect(download.suggestedFilename()).toMatch(
            /^NeoIPC-Surveillance-Partner-Report_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/
        )
    })
})
