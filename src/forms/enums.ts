import i18n from '@dhis2/d2-i18n'

/**
 * Vendored copies of the reporting service's report-parameter enums and
 * content flags:
 *
 *   - {@link ConfidenceIntervalModeValues}: its `ConfidenceIntervalMode.cs`
 *   - {@link includeElementKeys}: the per-element `includeX` render flags
 *     on the Partner- and Reference-Report parameter surfaces
 *
 * The schema-as-contract drift check (`scripts/check-schema-drift.mjs`)
 * verifies the wire-field tuples against the vendored
 * `src/schemas/*-report.json` snapshots and against the backend's
 * compiled `<Report>ApiParameters.Schema` arrays. Backend rename or
 * insert: schema-drift check fails, this file gets updated, form
 * spec updated, all in the same change.
 */

/**
 * Wire values for the `confidenceIntervals` query parameter. The backend
 * (`ConfidenceIntervalMode.cs` and the vendored `partner-report.json` /
 * `reference-report.json` schemas) declares the accepted values as
 * lowercase tokens, so these strings go directly onto the wire.
 *
 * Use {@link confidenceIntervalModeLabel} to render a localised
 * title-cased label for UI display.
 */
export const ConfidenceIntervalModeValues = ['all', 'rate', 'none'] as const

export type ConfidenceIntervalMode = (typeof ConfidenceIntervalModeValues)[number]

/**
 * Localised display label for a {@link ConfidenceIntervalMode}. Uses a
 * switch with literal `i18n.t('...')` calls so the d2-i18n extractor
 * picks the strings up into `i18n/en.pot`; passing `mode` directly to
 * `i18n.t` would be a dynamic argument that the extractor skips.
 */
export const confidenceIntervalModeLabel = (
    mode: ConfidenceIntervalMode
): string => {
    switch (mode) {
        case 'all':
            return i18n.t('All')
        case 'rate':
            return i18n.t('Rate')
        case 'none':
            return i18n.t('None')
    }
}

/**
 * The per-element content-toggle keys shared by the Partner and Reference
 * forms. Each is an `includeX` boolean render flag (a figure or table the
 * report can include or omit); the two reports expose the same elements,
 * so one list drives both forms' content checkboxes, in the order the
 * reports place them. These are exactly the `boolean` `includeX` keys of
 * `PartnerReportFormValues` / `ReferenceReportFormValues`.
 */
export const includeElementKeys = [
    'includeValidationSummaryTable',
    'includeBirthWeightFigure',
    'includeGestationalAgeFigure',
    'includeIncidenceDensityTable',
    'includeDeviceAssociatedIncidenceDensityTable',
    'includeAgentPerInfectionRateTable',
    'includeInfectiousAgentDetectionRateTable',
    'includeRiskDensityRateTable',
    'includeAntibioticUtilisationTable',
    'includeSurgicalProcedureRateTable',
    'includeResistantPathogenInfectionRateTable',
    'includeOrganismResistanceRateTable',
    'includeAntibioticResistanceTestRateTable',
    'includeSecondaryBsiRateTable',
] as const

export type IncludeElementKey = (typeof includeElementKeys)[number]

/**
 * Localised display label for an {@link IncludeElementKey}. Mapped per
 * key (rather than computed by splitting the identifier) so each label
 * is a literal `i18n.t('...')` call the d2-i18n extractor picks up, and
 * so individual labels can be copyedited independently (e.g.
 * capitalising acronyms like `BSI`).
 */
export const includeElementLabel = (key: IncludeElementKey): string => {
    switch (key) {
        case 'includeValidationSummaryTable':
            return i18n.t('Data validation summary table')
        case 'includeBirthWeightFigure':
            return i18n.t('Birth weight figure')
        case 'includeGestationalAgeFigure':
            return i18n.t('Gestational age figure')
        case 'includeIncidenceDensityTable':
            return i18n.t('Incidence density table')
        case 'includeDeviceAssociatedIncidenceDensityTable':
            return i18n.t('Device-associated incidence density table')
        case 'includeAgentPerInfectionRateTable':
            return i18n.t('Agent per infection rate table')
        case 'includeInfectiousAgentDetectionRateTable':
            return i18n.t('Infectious agent detection rate table')
        case 'includeRiskDensityRateTable':
            return i18n.t('Risk density rate table')
        case 'includeAntibioticUtilisationTable':
            return i18n.t('Antibiotic utilisation table')
        case 'includeSurgicalProcedureRateTable':
            return i18n.t('Surgical procedure rate table')
        case 'includeResistantPathogenInfectionRateTable':
            return i18n.t('Resistant pathogen infection rate table')
        case 'includeOrganismResistanceRateTable':
            return i18n.t('Organism resistance rate table')
        case 'includeAntibioticResistanceTestRateTable':
            return i18n.t('Antibiotic resistance test rate table')
        case 'includeSecondaryBsiRateTable':
            return i18n.t('Secondary BSI rate table')
    }
}
