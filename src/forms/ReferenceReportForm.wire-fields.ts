import type { ReferenceReportFormValues } from './ReferenceReportForm'

/**
 * The per-report wire-parameter names that {@link ReferenceReportFormValues}
 * sends to `GET /reference-report`. Drift-checked against
 * {@link ../schemas/reference-report.json} by
 * `scripts/check-schema-drift.mjs` (build-time gate via the prebuild
 * script in `package.json`).
 *
 * Base-level cross-cutting params (`locale`) and form-control state
 * (`outputFormat`) are excluded — they are not in the per-report
 * schema. The compile-time {@link _wireFieldExhaustiveness} check
 * below enforces that this exclusion list and the wire-field tuple
 * together cover every key of {@link ReferenceReportFormValues}.
 */
export const referenceReportWireFields = [
    'referenceDataId',
    'reportingPeriodFrom',
    'reportingPeriodTo',
    'birthWeightFrom',
    'birthWeightTo',
    'gestationalAgeFrom',
    'gestationalAgeTo',
    'countryFilter',
    'departmentFilter',
    'testUnitFilter',
    'defaultPatientFilter',
    'sparseDataThreshold',
    'confidenceIntervals',
    'includeIntroductionTexts',
    'includeMethodsTexts',
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

type ReferenceReportNonWireKey = 'outputFormat' | 'locale'

type ReferenceReportWireField = Exclude<
    keyof ReferenceReportFormValues,
    ReferenceReportNonWireKey
>

type AssertEqual<A, B> =
    [Exclude<A, B>] extends [never]
        ? [Exclude<B, A>] extends [never]
            ? true
            : false
        : false

const _wireFieldExhaustiveness: AssertEqual<
    (typeof referenceReportWireFields)[number],
    ReferenceReportWireField
> = true
void _wireFieldExhaustiveness
