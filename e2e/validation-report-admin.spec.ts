import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import { userByKey } from './users'
import { NEOIPC_BASE, UNMATCHED_VALIDATION_EXCEPTIONS_FIXTURE, readState } from './api'
import {
    gotoApp,
    setOutputFormat,
    selectDepartment,
    clickGenerate,
    expectRenderedReport,
} from './report-actions'

/**
 * The Validation Report's administrator controls, as the superadmin (`ALL`
 * satisfies `F_NEOIPC_ADMIN`): the report rendered without the stored
 * validation-exception list, the appendix of the list's records that exempt
 * nothing, and the address the report's patient links point to. A test that
 * needs a stored list stores `validation-exceptions-unmatched.csv` and removes
 * it afterwards, as the admin CRUD spec does with the same singleton; the
 * fixture's one record names a patient the seed does not hold.
 */

/** The department picker on this form: an optional filter, which never collapses. */
const DEPARTMENT_PICKER = { fieldName: 'departmentFilter', collapses: false }

const storeExceptionList = async (page: Page): Promise<void> => {
    const res = await page.request.put(`${NEOIPC_BASE}/admin/validation-exceptions`, {
        params: { displayName: `e2e-valex-admin-${Date.now().toString(36)}` },
        headers: { 'Content-Type': 'text/csv' },
        data: fs.readFileSync(UNMATCHED_VALIDATION_EXCEPTIONS_FIXTURE),
    })
    expect(res.status(), await res.text()).toBe(200)
}

const removeExceptionList = async (page: Page): Promise<void> => {
    await page.request.delete(`${NEOIPC_BASE}/admin/validation-exceptions`)
}

/**
 * Render the report for the seeded department as HTML, with "More options"
 * open for `choose` to set what the test needs, and return the query the
 * request carried and the report.
 */
const generate = async (
    page: Page,
    choose: () => Promise<void>
): Promise<{ query: URLSearchParams; report: Locator }> => {
    const { orgUnitDisplayNames } = readState()
    await gotoApp(page, '/reports/validation')
    await selectDepartment(page, orgUnitDisplayNames.AT_TEST_TEST, DEPARTMENT_PICKER)
    await setOutputFormat(page, 'html')
    await page.getByRole('button', { name: 'More options' }).click()
    await choose()
    const [request] = await Promise.all([
        page.waitForRequest(
            (req) => req.url().includes('/validation-report?') && req.method() === 'GET'
        ),
        clickGenerate(page),
    ])
    return { query: new URL(request.url()).searchParams, report: await expectRenderedReport(page) }
}

test.describe('validation report, administrator controls', () => {
    test.use({ storageState: userByKey('superadmin').storageState })

    test('renders without the stored exception list when asked, and says so', async ({ page }) => {
        await storeExceptionList(page)
        try {
            const { query, report } = await generate(page, async () => {
                const appendix = page.locator('input[name="includeUnusedValidationExceptions"]')
                await appendix.check()
                await page.locator('input[name="applyValidationExceptions"]').uncheck()
                // Without the list there is nothing for the appendix to list, so switching the
                // list off clears the appendix too.
                await expect(appendix).toBeDisabled()
                await expect(appendix).not.toBeChecked()
            })
            expect(query.get('applyValidationExceptions')).toBe('false')
            expect(query.get('includeUnusedValidationExceptions')).toBe('false')
            await expect(report).toContainText(
                'Not applied; an administrator rendered this report without the exception list'
            )
            await expect(report).toContainText(/List uploaded on \S/)
        } finally {
            await removeExceptionList(page)
        }
    })

    test('adds the appendix of the exception records that exempt nothing', async ({ page }) => {
        await storeExceptionList(page)
        try {
            const { query, report } = await generate(page, async () => {
                await page.locator('input[name="includeUnusedValidationExceptions"]').check()
            })
            expect(query.get('includeUnusedValidationExceptions')).toBe('true')
            await expect(report).toContainText('Applied; no record exempted')
            await expect(report.getByRole('heading', { name: 'Unused Validation Exceptions' })).toBeVisible()
            await expect(
                report.getByRole('row').filter({ hasText: 'E2E-UNMATCHED-PATIENT' })
            ).toContainText('Matches no record')
        } finally {
            await removeExceptionList(page)
        }
    })

    // The harness sets the reporting service's public address to the DHIS2 the
    // browser reaches, as production sets its own, so the note names this
    // page's origin.
    test('shows the address the report links patients to', async ({ page }) => {
        await gotoApp(page, '/reports/validation')
        await page.getByRole('button', { name: 'More options' }).click()
        const origin = new URL(page.url()).origin
        await expect(
            page.getByText(`Patient links in the report point to ${origin}/`)
        ).toBeVisible()
    })
})
