/**
 * A single org-unit row as fetched by {@link orgUnitsQuery}. Beyond the
 * `code` the pickers select on, each row carries the data the report
 * forms derive facts from:
 *  - `organisationUnitGroups[code]` — group membership (the Partner
 *    form checks for `NEOIPC_ALL_PATIENTS_ELIGIBLE`);
 *  - `ancestors[code,organisationUnitGroups[code]]` — so a department
 *    can be resolved to its country (the ancestor in the `COUNTRY`
 *    group) for benchmark Auto-match, without depending on hierarchy
 *    depth.
 */
export interface OrgUnitRow {
    id: string
    code: string | null
    displayName: string
    parent?: { displayName: string }
    organisationUnitGroups?: { code: string | null }[]
    ancestors?: {
        code: string | null
        organisationUnitGroups?: { code: string | null }[]
    }[]
}

export interface OrgUnitsPage {
    ous: {
        pager?: { page: number; pageCount: number }
        organisationUnits: OrgUnitRow[]
    }
}

// Per-request page size. The picker pages through *every* page and
// accumulates the results, so this is only the request granularity —
// not a cap on how many org units are selectable. This replaces the
// deprecated `paging: false`, which loaded everything in one unbounded
// request.
export const PAGE_SIZE = 500

/**
 * One page of the org-unit query for {@link OrganisationUnitMultiSelect},
 * filtered to the org-unit **group** that identifies the role (Country /
 * Hospital / Department), scoped to the current user's data-view subtree
 * (`withinUserHierarchy`). This mirrors neoipcr's metadata query
 * (`organisationUnitGroups.code:eq:NEO_DEPARTMENT` + `withinUserHierarchy`)
 * rather than filtering by hierarchy level, which is not a stable
 * contract — see `dhis2Constants` for the rationale.
 */
export const orgUnitsQuery = (groupCode: string, page: number) => ({
    ous: {
        resource: 'organisationUnits',
        params: {
            withinUserHierarchy: true,
            filter: [`organisationUnitGroups.code:eq:${groupCode}`],
            fields:
                'id,code,displayName,parent[displayName],' +
                'organisationUnitGroups[code],' +
                'ancestors[code,organisationUnitGroups[code]]',
            // Deterministic order so pages don't overlap or skip rows.
            order: 'id:asc',
            pageSize: PAGE_SIZE,
            page,
        },
    },
})

/**
 * `true` if any of `selectedCodes` resolves to a row that belongs to the
 * org-unit group `groupCode`. Used to gate the Partner Report's
 * "include non-core patients" toggle on membership of
 * `NEOIPC_ALL_PATIENTS_ELIGIBLE`. Rows not present in `rows` (not yet
 * loaded, or outside the user's scope) simply don't contribute.
 */
export const anySelectedInGroup = (
    rows: OrgUnitRow[],
    selectedCodes: string[],
    groupCode: string
): boolean => {
    const selected = new Set(selectedCodes)
    return rows.some(
        (row) =>
            row.code !== null &&
            selected.has(row.code) &&
            (row.organisationUnitGroups ?? []).some(
                (group) => group.code === groupCode
            )
    )
}

/**
 * Distinct ancestor-country codes of the selected org-units. A
 * department's country is the ancestor that belongs to the `COUNTRY`
 * org-unit group (`countryGroupCode`) — resolved by group membership,
 * not by hierarchy level, so it holds regardless of how deep the
 * department sits. Codeless ancestors and unmatched selections are
 * skipped. Feeds the benchmark Auto-match country comparison.
 */
export const ancestorCountryCodesForSelection = (
    rows: OrgUnitRow[],
    selectedCodes: string[],
    countryGroupCode: string
): string[] => {
    const selected = new Set(selectedCodes)
    const countries = new Set<string>()
    for (const row of rows) {
        if (row.code === null || !selected.has(row.code)) continue
        for (const ancestor of row.ancestors ?? []) {
            const isCountry = (ancestor.organisationUnitGroups ?? []).some(
                (group) => group.code === countryGroupCode
            )
            if (isCountry && ancestor.code) {
                countries.add(ancestor.code)
            }
        }
    }
    return [...countries]
}

/**
 * The set of pickable `code`s in `rows`: those with a non-empty code that do
 * not belong to any group in `excludeGroupCodes`. `OrganisationUnitMultiSelect`
 * shares one call across the option list, the crash-guard on `selected`, and
 * the selection reconciliation, so all three agree on exactly what is
 * currently pickable.
 */
export const pickableCodeSet = (
    rows: OrgUnitRow[],
    excludeGroupCodes: readonly string[]
): Set<string> => {
    const excluded = new Set(excludeGroupCodes)
    const codes = new Set<string>()
    for (const row of rows) {
        if (row.code === null || row.code === '') continue
        const inExcluded = (row.organisationUnitGroups ?? []).some(
            (group) => group.code !== null && excluded.has(group.code)
        )
        if (!inExcluded) codes.add(row.code)
    }
    return codes
}

/**
 * The selection the picker should hold, given what is currently pickable.
 *
 * Two rules, in order:
 *  - with `collapseWhenSingle` and exactly one pickable option, that option —
 *    it is the only valid non-empty selection, so it is taken rather than
 *    asked for;
 *  - otherwise the current selection minus anything no longer pickable (a
 *    decommissioned unit, or a test department once "Include test data" is
 *    switched off).
 *
 * Pure, so the picker's reconciliation can be reasoned about and tested without
 * a data engine or a rendered component. Returns a new array; compare it to the
 * current selection by **contents**, not length — replacing an unavailable code
 * with the single available one leaves the length at 1.
 */
export const desiredSelection = (
    rows: OrgUnitRow[],
    excludeGroupCodes: readonly string[],
    selectedCodes: string[],
    collapseWhenSingle: boolean
): string[] => {
    const available = pickableCodeSet(rows, excludeGroupCodes)
    if (collapseWhenSingle && available.size === 1) return [...available]
    return selectedCodes.filter((code) => available.has(code))
}

/**
 * True when `rows` has coded units but every one is removed by
 * `excludeGroupCodes` — i.e. the picker is empty *because of the exclusion*,
 * not because the scope is empty. Drives the Partner and Validation forms'
 * "all your departments are excluded test units" notice, so a non-admin
 * scoped only to test units gets an explanation instead of a silent empty
 * picker.
 */
export const allCodedUnitsExcluded = (
    rows: OrgUnitRow[],
    excludeGroupCodes: readonly string[]
): boolean =>
    pickableCodeSet(rows, []).size > 0 &&
    pickableCodeSet(rows, excludeGroupCodes).size === 0
