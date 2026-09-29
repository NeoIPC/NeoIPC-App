import { expect, type Page, type Locator, type Download } from '@playwright/test'
import { appUrl } from './api'

/** Generous ceiling for a backend (Quarto/R) render. */
export const RENDER_TIMEOUT = 12 * 60 * 1000

/**
 * Wait for an HTML render to finish, failing fast (and clearly) if the app shows
 * the "Report rendering failed" panel instead of the report fragment — otherwise
 * a render error hangs the spec until the full render timeout. Returns the report
 * container on success.
 */
export async function expectRenderedReport(
    page: Page,
    timeout = RENDER_TIMEOUT
): Promise<Locator> {
    const report = page.locator('#neoipc-rendered-report')
    const failure = page.getByText('Report rendering failed')
    const which = await Promise.race([
        report
            .waitFor({ state: 'visible', timeout })
            .then(() => 'report' as const)
            .catch(() => 'timeout' as const),
        failure
            .waitFor({ state: 'visible', timeout })
            .then(() => 'failed' as const)
            .catch(() => 'timeout' as const),
    ])
    if (which === 'failed') {
        throw new Error(
            'Report render failed — the app showed the "Report rendering failed" panel.'
        )
    }
    if (which === 'timeout') {
        throw new Error('Report render did not complete within the timeout.')
    }
    return report
}

/**
 * Trigger a render whose result downloads rather than mounting inline (PDF, or
 * the JSON dataset) and return the download, failing fast if the app shows the
 * "Report rendering failed" panel instead of firing one.
 */
export async function expectDownload(
    page: Page,
    trigger: () => Promise<void>,
    timeout = RENDER_TIMEOUT
): Promise<Download> {
    const failure = page.getByText('Report rendering failed')
    const downloadPromise = page.waitForEvent('download', { timeout })
    await trigger()
    const outcome = await Promise.race([
        downloadPromise
            .then((download) => ({ kind: 'download' as const, download }))
            .catch(() => ({ kind: 'timeout' as const })),
        failure
            .waitFor({ state: 'visible', timeout })
            .then(() => ({ kind: 'failed' as const }))
            .catch(() => ({ kind: 'timeout' as const })),
    ])
    if (outcome.kind === 'failed') {
        throw new Error(
            'Render failed — the app showed the "Report rendering failed" panel.'
        )
    }
    if (outcome.kind === 'timeout') {
        throw new Error('Download did not fire within the timeout.')
    }
    return outcome.download
}

/**
 * Navigate to an in-app HashRouter route (on the installed bundle) and wait
 * for the shell to mount — the left-nav renders once the `me` query and
 * reference metadata resolve. All e2e personas hold NeoIPC access, so at least
 * one menu item is always present.
 */
export async function gotoApp(page: Page, route: string): Promise<void> {
    await page.goto(appUrl(route))
    await expect(page.getByRole('menuitem').first()).toBeVisible()
}

/**
 * Set the output format radio. `json` is Partner-Report only, and selecting it
 * also forces the data source to online — the form couples the two because the
 * service produces that dataset only from the live path.
 */
export async function setOutputFormat(
    page: Page,
    format: 'html' | 'pdf' | 'json'
): Promise<void> {
    await page.locator(`input[name="outputFormat"][value="${format}"]`).check()
}

/** Set the Partner-Report data-source radio (`online` | `dataFile`). */
export async function setDataSource(
    page: Page,
    mode: 'online' | 'dataFile'
): Promise<void> {
    await page.locator(`input[name="mode"][value="${mode}"]`).check()
}

/**
 * Set a `DateField` (which wraps `@dhis2/ui`'s `CalendarInput`) to an ISO
 * `YYYY-MM-DD` date and commit it to form state.
 *
 * `CalendarInput` only calls `onDateSelect` — the callback that flows into the
 * form via `DateField` — on blur, a calendar-cell pick, or Clear; typing (or a
 * raw `fill()`) updates the widget's internal `partialDate` only. So the fill
 * must be followed by a blur, or the form value stays empty and the period
 * filter is silently dropped from the request. The blur also closes the calendar
 * overlay (CalendarInput's own `setOpen(false)`), so each field commits
 * independently without relying on the next field's focus.
 */
export async function setDateField(
    page: Page,
    name: string,
    isoDate: string
): Promise<void> {
    const input = page.locator(`input[name="${name}"]`)
    await input.fill(isoDate)
    await input.blur()
}

/**
 * Ensure a report form's department picker covers `deptDisplayName` (matched
 * as a substring, since the label is "Hospital — Department" when
 * `showParentInLabel` is set). `fieldName` is the picker's `name`, which is also
 * its `data-test`: `unitCodes` (the default) on the Partner Report,
 * `departmentFilter` on the Validation Report.
 *
 * `collapses` says whether the form collapses a single pickable department to
 * a labelled value. The Partner Report does, because its departments are the
 * report's subject: a user with exactly one gets that value instead of a
 * picker, the unit already selected. Which of the two renders there depends on
 * the persona and on "Include test data", so wait for whichever arrives rather
 * than assuming: both appear only after the org-unit rows load, so a
 * point-in-time check races that fetch. The Validation Report's picker is an
 * optional filter, where empty means every department, so it never collapses
 * and its caller passes `false`.
 *
 * The collapsed branch still asserts the value names the wanted department. A
 * bare early return would also pass if the picker collapsed onto the *wrong*
 * unit — the failure this helper is most likely to hide, since every later
 * assertion would then describe a report about a department nobody asked for.
 */
export async function selectDepartment(
    page: Page,
    deptDisplayName: string,
    {
        fieldName = 'unitCodes',
        collapses = true,
    }: { fieldName?: string; collapses?: boolean } = {}
): Promise<void> {
    const collapsed = page.locator(`[data-test="${fieldName}-single"]`)
    const picker = page.locator(`[data-test="${fieldName}"]`)

    // Wait for the collapsed value, and treat its absence as the answer.
    //
    // The obvious barrier — wait for either control, then branch — does not
    // work: @dhis2-ui/field puts `dataTest` on its root unconditionally, so the
    // picker is in the DOM *while the org units are still loading*, and the
    // component only decides to collapse once they arrive. The barrier
    // therefore resolves on a loading picker, the branch chooses wrong, and the
    // click races the swap — which is a timeout on the slower engines rather
    // than an assertion anyone can read. A closed MultiSelectField offers no
    // loading signal either: `loading` only changes the open menu's contents.
    //
    // So wait for the settled state that can be observed. A collapse always
    // arrives once the rows do; a picker that does not collapse this time costs
    // this wait once, and is then certainly loaded by the time it is clicked.
    //
    // A picker that can never collapse is never swapped out, so there is no
    // race to settle: it is clicked at once, and the option click below waits
    // while the open menu shows its own loading state.
    if (collapses) {
        const isCollapsed = await collapsed
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false)

        if (isCollapsed) {
            await expect(collapsed).toContainText(deptDisplayName)
            return
        }
    }

    await picker.click()
    await page
        .getByText(deptDisplayName, { exact: false })
        .first()
        .click()
    await page.keyboard.press('Escape')
}

/** Submit the report form via its primary Generate button. */
export async function clickGenerate(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Generate' }).click()
}

/**
 * Ensure the reference-dataset select (`data-test="referenceDataId"`) shows the
 * dataset carrying `displayName` (its label is "displayName — period", so a
 * substring text match identifies it).
 *
 * The form preselects the first saved dataset *asynchronously*, so the wanted one
 * usually surfaces on its own (in the select's value display and its summary
 * card). Wait for it — a retrying `waitFor`, not a point-in-time check, so the
 * decision doesn't race preselection — and return without touching the picker:
 * re-picking an already-selected `@dhis2/ui` option is a no-op that leaves the
 * menu (and its click-blocking backdrop) open, which then swallows the next
 * click. Only when a *different* dataset was preselected (the wanted label never
 * appears) do we open the menu and pick it. The option is matched inside
 * `#dhis2-portal-root`, where the open menu renders: `@dhis2/ui`'s
 * `SingleSelectOption` is a plain `<div>`, not an ARIA `option` (so
 * `getByRole('option')` never resolves), and scoping to the portal avoids
 * matching the value display, which sits behind the backdrop while the menu is
 * open. The trailing `Escape` guarantees the menu is closed even if the pick ever
 * lands on an already-selected option.
 */
export async function selectReferenceDataset(
    page: Page,
    displayName: string
): Promise<void> {
    const preselected = await page
        .getByText(displayName, { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    if (preselected) return
    await page.locator('[data-test="referenceDataId"]').click()
    await page
        .locator('#dhis2-portal-root')
        .getByText(displayName, { exact: false })
        .first()
        .click()
    await page.keyboard.press('Escape')
}
