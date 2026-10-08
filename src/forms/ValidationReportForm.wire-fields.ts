import type { ValidationReportFormValues } from './ValidationReportForm'

/**
 * The per-report wire-parameter names that {@link ValidationReportFormValues}
 * sends to `GET /validation-report`. Drift-checked against
 * {@link ../schemas/validation-report.json} by
 * `scripts/check-schema-drift.mjs` (build-time gate via the prebuild
 * script in `package.json`).
 *
 * The base-level `locale` and the form-control state `outputFormat` are
 * excluded — they are not in the per-report schema. The compile-time
 * {@link _wireFieldExhaustiveness} check below enforces that this exclusion
 * list and the wire-field tuple together cover every key of
 * {@link ValidationReportFormValues}.
 */
export const validationReportWireFields = [
    'departmentFilter',
    'rules',
    'includeTestData',
    'applyValidationExceptions',
    'includeUnusedValidationExceptions',
] as const

type ValidationReportNonWireKey = 'outputFormat' | 'locale'

type ValidationReportWireField = Exclude<
    keyof ValidationReportFormValues,
    ValidationReportNonWireKey
>

type AssertEqual<A, B> =
    [Exclude<A, B>] extends [never]
        ? [Exclude<B, A>] extends [never]
            ? true
            : false
        : false

const _wireFieldExhaustiveness: AssertEqual<
    (typeof validationReportWireFields)[number],
    ValidationReportWireField
> = true
void _wireFieldExhaustiveness
