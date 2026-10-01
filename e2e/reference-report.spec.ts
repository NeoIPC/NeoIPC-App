import { test, expect } from '@playwright/test'
import { userByKey } from './users'
import { readState } from './api'
import {
    gotoApp,
    setOutputFormat,
    clickGenerate,
    selectReferenceDataset,
    expectRenderedReport,
    expectDownload,
} from './report-actions'

/**
 * Reference report, stored-data mode: render the reference dataset that global
 * setup uploaded, as the AT report user (report-only — the admin live-fetch
 * filters are hidden, and Generate is disabled until a dataset is picked).
 * Skipped when no fixture was uploaded (placeholder — see e2e/fixtures/README.md).
 */
test.describe('reference report — stored dataset', () => {
    test.use({ storageState: userByKey('atReport').storageState })

    test('HTML output renders the selected reference dataset', async ({
        page,
    }) => {
        const { referenceFixture } = readState()
        test.skip(
            !referenceFixture,
            'no reference dataset uploaded — provide a real reference-data.json (see e2e/fixtures/README.md)'
        )
        await gotoApp(page, '/reports/reference')
        await selectReferenceDataset(page, referenceFixture!.displayName)
        await setOutputFormat(page, 'html')
        await clickGenerate(page)

        const report = await expectRenderedReport(page)
        await expect(report.locator('table').first()).toBeVisible()
        // The data-validation summary is the first section after the header,
        // and the form asks for it by default. A dataset serialized before the
        // summary existed renders the section with a sentence saying so, so
        // the heading is there whichever the fixture is.
        await expect(
            report.getByRole('heading', { name: 'Data Validation' })
        ).toBeVisible()
    })

    test('PDF output triggers a PDF download', async ({
        page,
    }) => {
        const { referenceFixture } = readState()
        test.skip(
            !referenceFixture,
            'no reference dataset uploaded — provide a real reference-data.json (see e2e/fixtures/README.md)'
        )
        await gotoApp(page, '/reports/reference')
        await selectReferenceDataset(page, referenceFixture!.displayName)
        await setOutputFormat(page, 'pdf')

        const download = await expectDownload(page, () => clickGenerate(page))
        expect(download.suggestedFilename()).toMatch(
            /^NeoIPC-Surveillance-Reference-Report_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/
        )
    })
})
