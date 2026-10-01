import { test, expect } from '@playwright/test'
import { userByKey } from './users'
import { gotoApp } from './report-actions'

/**
 * Authority-driven left-nav filtering (`visibleCategories` in
 * `src/menu/categories.tsx`): the three report items require `F_NEOIPC_REPORT`,
 * the two admin items require `F_NEOIPC_ADMIN`. A Superuser (`ALL`) sees all
 * five; a report-only user sees the three report items and neither admin item.
 */

const REPORT_ITEMS = ['Partner Report', 'Reference Report', 'Validation Report']
const ADMIN_ITEMS = ['Reference data', 'Validation exceptions']

test.describe('superadmin', () => {
    test.use({ storageState: userByKey('superadmin').storageState })

    test('sees all five nav categories', async ({ page }) => {
        await gotoApp(page, '/reports/partner')
        for (const name of [...REPORT_ITEMS, ...ADMIN_ITEMS]) {
            await expect(page.getByRole('menuitem', { name })).toBeVisible()
        }
    })
})

test.describe('report-only user', () => {
    test.use({ storageState: userByKey('atReport').storageState })

    test('sees the three report items and neither admin item', async ({
        page,
    }) => {
        await gotoApp(page, '/reports/partner')
        for (const name of REPORT_ITEMS) {
            await expect(page.getByRole('menuitem', { name })).toBeVisible()
        }
        for (const name of ADMIN_ITEMS) {
            await expect(page.getByRole('menuitem', { name })).toHaveCount(0)
        }
    })
})
