import i18n from '@dhis2/d2-i18n'
import { NoticeBox, SingleSelectField, SingleSelectOption } from '@dhis2/ui'
import React, { FC, useMemo, useState } from 'react'
import type { PublicReferenceDataMetadata } from '../AppContext'
import ReferenceDataCard from './ReferenceDataCard'
import {
    cohortLabel,
    formatReportingPeriod,
    periodSortKey,
} from './referenceDataFormat'

interface ReferenceDataSelectProps {
    /** The public reference-data listing to choose from. */
    datasets: PublicReferenceDataMetadata[]
    /** Selected dataset id (`''` = none). */
    value: string
    onChange: (id: string) => void
    /** Label/help for the result select (defaults to a generic label). */
    label?: string
    helpText?: string
    disabled?: boolean
    /**
     * When `true`, the metadata card warns that the selection is an
     * approximate Auto-match (no exact cohort/country match existed).
     */
    approximate?: boolean
    /** Country code → display-name map (from `useOrgUnitNames`); the
     *  country facet and card show raw codes without it. */
    countryNames?: Record<string, string>
    /** `data-test` for the main result select, so the e2e suite can target
     *  it directly (mirrors the department picker's `data-test`). */
    dataTest?: string
    /** Whether to offer the "(none)" option. `true` (default) for the Partner
     *  benchmark (no benchmark is valid) and Reference-Report admins (who can
     *  live-fetch); pass `false` for report users, who cannot render "(none)". */
    allowNone?: boolean
}

const unique = (values: string[]): string[] => [...new Set(values)]

const optionLabel = (dataset: PublicReferenceDataMetadata): string =>
    `${dataset.displayName} — ${formatReportingPeriod(
        dataset.reportingPeriodFrom,
        dataset.reportingPeriodTo
    )}`

/**
 * Shared faceted picker for a saved reference dataset. Used both for the
 * Reference Report's `referenceDataId` and (in Manual mode) the Partner
 * Report's benchmark `referenceDataFile`. Facets — reporting period,
 * country, and cohort — narrow the result select (whose own built-in filter
 * handles name search); the full list is sorted latest-period-first. A
 * metadata card summarizes the current selection. `@dhis2/ui` has no tree, so
 * independent facets fit the orthogonal dimensions better than a hierarchy
 * would.
 */
const ReferenceDataSelect: FC<ReferenceDataSelectProps> = ({
    datasets,
    value,
    onChange,
    label,
    helpText,
    disabled,
    approximate = false,
    countryNames,
    dataTest,
    allowNone = true,
}) => {
    const [period, setPeriod] = useState('')
    const [country, setCountry] = useState('')
    const [cohort, setCohort] = useState('')

    const periods = useMemo(
        () =>
            unique(
                datasets.map((d) =>
                    formatReportingPeriod(
                        d.reportingPeriodFrom,
                        d.reportingPeriodTo
                    )
                )
            ),
        [datasets]
    )
    const countryLabel = (code: string): string => countryNames?.[code] ?? code
    const countries = useMemo(
        () =>
            unique(datasets.flatMap((d) => d.countries ?? [])).sort((a, b) =>
                countryLabel(a).localeCompare(countryLabel(b))
            ),
        // countryNames feeds the sort order via countryLabel.
        [datasets, countryNames]
    )
    const cohorts = useMemo(() => unique(datasets.map(cohortLabel)), [datasets])

    const selected = datasets.find((d) => d.id === value) ?? null

    const visible = useMemo(() => {
        const matches = datasets.filter(
            (d) =>
                (period === '' ||
                    formatReportingPeriod(
                        d.reportingPeriodFrom,
                        d.reportingPeriodTo
                    ) === period) &&
                (country === '' ||
                    (d.countries ?? []).length === 0 ||
                    (d.countries ?? []).includes(country)) &&
                (cohort === '' || cohortLabel(d) === cohort)
        )
        // Keep the current selection visible even if facets would hide it.
        if (selected && !matches.some((d) => d.id === selected.id)) {
            matches.push(selected)
        }
        return matches.sort((a, b) =>
            periodSortKey(b).localeCompare(periodSortKey(a))
        )
    }, [datasets, period, country, cohort, selected])

    if (datasets.length === 0) {
        return (
            <NoticeBox warning title={i18n.t('No reference datasets')}>
                {i18n.t('No saved reference datasets are available yet.')}
            </NoticeBox>
        )
    }

    return (
        <div>
            {periods.length > 1 && (
                <SingleSelectField
                    label={i18n.t('Reporting period')}
                    placeholder={i18n.t('Any')}
                    selected={period}
                    clearable
                    clearText={i18n.t('Any')}
                    disabled={disabled}
                    onChange={({ selected: s }) => setPeriod(s ?? '')}
                >
                    {periods.map((p) => (
                        <SingleSelectOption key={p} value={p} label={p} />
                    ))}
                </SingleSelectField>
            )}
            {datasets.length > 1 && countries.length > 1 && (
                <SingleSelectField
                    label={i18n.t('Country')}
                    placeholder={i18n.t('Any')}
                    selected={country}
                    clearable
                    clearText={i18n.t('Any')}
                    disabled={disabled}
                    onChange={({ selected: s }) => setCountry(s ?? '')}
                >
                    {countries.map((c) => (
                        <SingleSelectOption
                            key={c}
                            value={c}
                            label={countryLabel(c)}
                        />
                    ))}
                </SingleSelectField>
            )}
            {cohorts.length > 1 && (
                <SingleSelectField
                    label={i18n.t('Cohort')}
                    placeholder={i18n.t('Any')}
                    selected={cohort}
                    clearable
                    clearText={i18n.t('Any')}
                    disabled={disabled}
                    onChange={({ selected: s }) => setCohort(s ?? '')}
                >
                    {cohorts.map((c) => (
                        <SingleSelectOption key={c} value={c} label={c} />
                    ))}
                </SingleSelectField>
            )}
            <SingleSelectField
                label={label ?? i18n.t('Reference dataset')}
                dataTest={dataTest}
                helpText={helpText}
                selected={value}
                disabled={disabled}
                filterable
                filterPlaceholder={i18n.t('Search')}
                noMatchText={i18n.t('No match')}
                onChange={({ selected: s }) => onChange(s ?? '')}
            >
                {allowNone && (
                    <SingleSelectOption value="" label={i18n.t('(none)')} />
                )}
                {visible.map((d) => (
                    <SingleSelectOption
                        key={d.id}
                        value={d.id}
                        label={optionLabel(d)}
                    />
                ))}
            </SingleSelectField>

            {selected && (
                <ReferenceDataCard
                    dataset={selected}
                    approximate={approximate}
                    countryNames={countryNames}
                />
            )}
        </div>
    )
}

export default ReferenceDataSelect
