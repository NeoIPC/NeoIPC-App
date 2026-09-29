import type { PartnerReportFormValues } from './PartnerReportForm'

/**
 * The per-report wire-parameter names that {@link PartnerReportFormValues}
 * sends to `GET /partner-report` / `POST /partner-report`. Drift-checked
 * against {@link ../schemas/partner-report.json} by
 * `scripts/check-schema-drift.mjs` (build-time gate via the prebuild
 * script in `package.json`).
 *
 * Base-level cross-cutting params (`locale`) and form-control state
 * (`mode`, `dataFile`, `outputFormat`) are excluded — they are not in
 * the per-report schema. The compile-time {@link _wireFieldExhaustiveness}
 * check below enforces that this exclusion list and the wire-field
 * tuple together cover every key of {@link PartnerReportFormValues}.
 */
export const partnerReportWireFields = [
    'referenceDataFile',
    'unitCodes',
    'reportingPeriodFrom',
    'reportingPeriodTo',
    'birthWeightFrom',
    'birthWeightTo',
    'gestationalAgeFrom',
    'gestationalAgeTo',
    'includeNonCorePatients',
    'includeTestData',
    'sparseDataThreshold',
    'confidenceIntervals',
    'includeIntroductionTexts',
    'includeMethodsTexts',
    'includeOutlierInterpretation',
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

type PartnerReportNonWireKey =
    | 'mode'
    | 'dataFile'
    | 'outputFormat'
    | 'locale'

type PartnerReportWireField = Exclude<
    keyof PartnerReportFormValues,
    PartnerReportNonWireKey
>

type AssertEqual<A, B> =
    [Exclude<A, B>] extends [never]
        ? [Exclude<B, A>] extends [never]
            ? true
            : false
        : false

const _wireFieldExhaustiveness: AssertEqual<
    (typeof partnerReportWireFields)[number],
    PartnerReportWireField
> = true
void _wireFieldExhaustiveness
