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
