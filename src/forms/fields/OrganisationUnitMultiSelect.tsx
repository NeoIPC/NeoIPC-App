import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { MultiSelectField, MultiSelectOption, NoticeBox } from '@dhis2/ui'
import React, { FC, useEffect, useRef, useState } from 'react'
import styles from '../formLayout.module.css'
import {
    OrgUnitRow,
    OrgUnitsPage,
    desiredSelection,
    orgUnitsQuery,
    pickableCodeSet,
} from './orgUnits'

interface OrganisationUnitMultiSelectProps {
    name: string
    label: string
    helpText?: string
    /**
     * Org-unit group code identifying the role to filter to
     * (`COUNTRY_GROUP_CODE`, `HOSPITAL_GROUP_CODE`, or
     * `DEPARTMENT_GROUP_CODE` from `dhis2Constants`).
     */
    groupCode: string
    /**
     * Optional org-unit group codes to *exclude* from the pickable
     * options — the complement of {@link groupCode}'s include filter. A
     * row belonging to any of these groups is dropped from the list and
     * reconciled out of the current selection. The report forms pass
     * `TEST_UNITS` on their department picker unless "Include test data"
     * is on, so test departments are only offered (and stay selected)
     * when the data layer would actually include them.
     */
    excludeGroupCodes?: string[]
    /**
     * Selected orgUnit codes. The picker emits and consumes `code`
     * strings (the wire format the report endpoints accept), not
     * orgUnit UIDs.
     */
    selectedCodes: string[]
    onChange: (codes: string[]) => void
    /** Show the parent's `displayName` as a prefix in option labels. */
    showParentInLabel?: boolean
    /**
     * Called once the full org-unit list has loaded, with the enriched
     * rows (group membership + ancestors). Lets a parent form derive
     * facts about the selected units — e.g. eligibility-group membership
     * or ancestor country — without issuing a second query.
     */
    onRowsLoaded?: (rows: OrgUnitRow[]) => void
    disabled?: boolean
    required?: boolean
    /** Mark the select invalid (red) with an inline validation message. */
    error?: boolean
    validationText?: string
    /**
     * Collapse the picker to a read-only value when exactly one option is
     * selectable, and select that option implicitly — a control offering one
     * choice is a question with one answer.
     *
     * Opt-in, because it is only correct where the selection is the report's
     * *subject*. On an optional filter an empty selection means "all", so
     * auto-selecting a lone option would silently narrow the report instead of
     * saving a click.
     *
     * The predicate is evaluated against the **currently** pickable set, so it
     * tracks `excludeGroupCodes`: a picker that is collapsed while test units
     * are excluded reappears, already holding its value, as soon as they are
     * included and a second option exists.
     */
    collapseWhenSingle?: boolean
    /**
     * Label for the collapsed single-value state. Supplied separately from
     * {@link label} because the two differ in grammatical number ("Departments"
     * vs "Department") and neither is derivable from the other in every
     * language.
     */
    singleLabel?: string
}

/**
 * Multi-select picker for orgUnits of a specific NeoIPC role
 * (Country / Hospital / Department). The list is filtered to
 *   - orgUnits within the current user's data-view hierarchy
 *     (`withinUserHierarchy`)
 *   - orgUnits in the role's org-unit group (the `groupCode` prop).
 *
 * Role is identified by group membership, not hierarchy level — see
 * `dhis2Constants` for why level is not a stable contract.
 *
 * Values are orgUnit `code` strings — the wire format the reports'
 * `UnitCodes` / `CountryFilter` / `DepartmentFilter` parameters expect
 * (Partner, Reference and Validation Report). OrgUnits without a `code` are
 * filtered out (un-pickable) and a `NoticeBox` warning is rendered
 * alongside the select so operators know to ask the NeoIPC metadata
 * maintainers to add the missing codes upstream.
 */
const OrganisationUnitMultiSelect: FC<OrganisationUnitMultiSelectProps> = ({
    name,
    label,
    helpText,
    groupCode,
    excludeGroupCodes,
    selectedCodes,
    onChange,
    showParentInLabel = false,
    onRowsLoaded,
    disabled,
    required,
    error: validationError,
    validationText,
    collapseWhenSingle = false,
    singleLabel,
}) => {
    const engine = useDataEngine()
    const [rows, setRows] = useState<OrgUnitRow[] | null>(null)
    const [error, setError] = useState<Error | null>(null)

    // Held in a ref so a changing `onRowsLoaded` identity doesn't
    // re-trigger the fetch effect (which keys only on engine + groupCode).
    const onRowsLoadedRef = useRef(onRowsLoaded)
    onRowsLoadedRef.current = onRowsLoaded

    // Held in a ref so the reconcile effect can call the latest onChange
    // without depending on it — its identity changes every render in the
    // usual `setField('unitCodes')` caller.
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    useEffect(() => {
        let cancelled = false
        setRows(null)
        setError(null)

        const fetchAllPages = async (): Promise<OrgUnitRow[]> => {
            const collected: OrgUnitRow[] = []
            let page = 1
            let pageCount = 1
            do {
                const result = (await engine.query(
                    orgUnitsQuery(groupCode, page)
                )) as unknown as OrgUnitsPage
                collected.push(...result.ous.organisationUnits)
                pageCount = result.ous.pager?.pageCount ?? 1
                page += 1
            } while (page <= pageCount)
            return collected
        }

        fetchAllPages()
            .then((all) => {
                if (!cancelled) {
                    setRows(all)
                    onRowsLoadedRef.current?.(all)
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error ? err : new Error(String(err))
                    )
                }
            })

        return () => {
            cancelled = true
        }
    }, [engine, groupCode])

    // Keep the parent's selection ⊆ the pickable options once the list has
    // loaded. It must not run while loading (`rows === null`): the option
    // set is empty then, and clearing a valid-but-not-yet-loaded selection
    // would drop it. After load it drops codes that are genuinely
    // unavailable — a decommissioned unit, or a `TEST_UNITS` department
    // once "Include test data" is switched off (it leaves the option set
    // via `excludeGroupCodes`).
    const excludeKey = (excludeGroupCodes ?? []).join(',')
    useEffect(() => {
        if (rows === null) return
        const desired = desiredSelection(
            rows,
            excludeGroupCodes ?? [],
            selectedCodes,
            collapseWhenSingle
        )
        // Compare contents, not just length: replacing a now-unavailable code
        // with the single available one keeps the length at 1.
        const changed =
            desired.length !== selectedCodes.length ||
            desired.some((code, i) => code !== selectedCodes[i])
        if (changed) {
            onChangeRef.current(desired)
        }
        // excludeGroupCodes is captured via excludeKey to avoid array-identity churn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, excludeKey, selectedCodes, collapseWhenSingle])

    if (error) {
        return (
            <NoticeBox error title={label}>
                {i18n.t('Failed to load organisation units — {{message}}', {
                    message: error.message,
                })}
            </NoticeBox>
        )
    }

    const loading = rows === null
    const loadedRows = rows ?? []
    const rowsWithoutCode = loadedRows.filter(
        (row) => row.code === null || row.code === ''
    )
    const pickableCodes = pickableCodeSet(loadedRows, excludeGroupCodes ?? [])
    const options = loadedRows
        .filter(
            (row): row is OrgUnitRow & { code: string } =>
                row.code !== null && pickableCodes.has(row.code)
        )
        .map((row) => ({
            value: row.code,
            label:
                showParentInLabel && row.parent?.displayName
                    ? `${row.parent.displayName} — ${row.displayName}`
                    : row.displayName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))

    // Decided only once the rows are in: while loading, `pickableCodes` is empty
    // and the picker would flash before collapsing.
    const onlyOption =
        collapseWhenSingle && !loading && options.length === 1 ? options[0] : null

    if (onlyOption) {
        return (
            <>
                {rowsWithoutCode.length > 0 && (
                    <NoticeBox
                        warning
                        title={i18n.t(
                            '{{count}} organisation unit(s) missing a code and not selectable',
                            { count: rowsWithoutCode.length }
                        )}
                    >
                        {i18n.t(
                            'These org units cannot be picked because they have no `code` set in DHIS2 metadata. Ask the NeoIPC metadata maintainers to add a code so they can be included in reports.'
                        )}
                    </NoticeBox>
                )}
                {/* A description list, not a labelled paragraph: this is a
                    term and its value, and the pairing is then native rather
                    than asserted. `aria-labelledby` is a prohibited attribute
                    on a paragraph, so the earlier markup left the label and
                    the value as two unrelated text nodes to a screen reader —
                    and axe reports that as `incomplete` rather than a
                    violation whenever the element has text, so the gate could
                    not have caught it either. */}
                <dl className={styles.staticField}>
                    <dt className={styles.staticFieldLabel}>
                        {singleLabel ?? label}
                    </dt>
                    <dd
                        className={styles.staticFieldValue}
                        data-test={`${name}-single`}
                    >
                        {onlyOption.label}
                    </dd>
                </dl>
            </>
        )
    }

    return (
        <>
            {rowsWithoutCode.length > 0 && (
                <NoticeBox
                    warning
                    title={i18n.t(
                        '{{count}} organisation unit(s) missing a code and not selectable',
                        { count: rowsWithoutCode.length }
                    )}
                >
                    {i18n.t(
                        'These org units cannot be picked because they have no `code` set in DHIS2 metadata. Ask the NeoIPC metadata maintainers to add a code so they can be included in reports.'
                    )}
                </NoticeBox>
            )}
            <MultiSelectField
            dataTest={name}
            label={label}
            helpText={helpText}
            loading={loading}
            disabled={disabled}
            required={required}
            error={validationError}
            validationText={validationError ? validationText : undefined}
            filterable
            clearable
            clearText={i18n.t('Clear')}
            filterPlaceholder={i18n.t('Search')}
            noMatchText={i18n.t('No match')}
            selected={selectedCodes.filter((code) => pickableCodes.has(code))}
            onChange={({ selected }) => onChange(selected)}
        >
            {options.map((option) => (
                <MultiSelectOption
                    key={option.value}
                    value={option.value}
                    label={option.label}
                />
            ))}
            </MultiSelectField>
        </>
    )
}

export default OrganisationUnitMultiSelect
