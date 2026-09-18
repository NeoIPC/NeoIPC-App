import {
    buildPartnerReportQuery,
    buildReferenceReportQuery,
} from '../api/reports'
import partnerSchema from '../schemas/partner-report.json'
import referenceSchema from '../schemas/reference-report.json'
import { defaultValues as partnerDefaults } from './PartnerReportForm'
import { defaultValues as referenceDefaults } from './ReferenceReportForm'

/**
 * The `default` preset is the form's initial values, sent as the request
 * the query builders produce. For every field whose schema states a
 * default, that request must either omit the field — the form default is
 * "unset" (`null` or `''`), so the report applies its own default — or
 * carry exactly the schema's value. A form default that disagrees with
 * the schema changes what the preset renders, silently, which is what
 * this test turns into a failure. The schema-drift script compares the
 * field *names*; this is the check on their *values*.
 */

interface SchemaField {
    name: string
    type: string
    default?: string
}

const isUnset = (value: unknown): boolean => value === null || value === ''

describe.each([
    {
        report: 'Partner Report',
        fields: partnerSchema.fields as SchemaField[],
        values: partnerDefaults as unknown as Record<string, unknown>,
        query: buildPartnerReportQuery(partnerDefaults, 'html'),
    },
    {
        report: 'Reference Report',
        fields: referenceSchema.fields as SchemaField[],
        values: referenceDefaults as unknown as Record<string, unknown>,
        query: buildReferenceReportQuery(referenceDefaults, 'html'),
    },
])('$report form defaults', ({ fields, values, query }) => {
    const withDefault = fields.filter((f) => f.default !== undefined)

    it('has schema fields with a default to hold the form to', () => {
        expect(withDefault.length).toBeGreaterThan(0)
    })

    it.each(withDefault.map((f) => [f.name, f.default as string]))(
        '%s: the default request sends %s or leaves it to the report',
        (name, schemaDefault) => {
            expect(values).toHaveProperty(name)
            if (isUnset(values[name])) {
                // `null` / `''` means "use the report's default", which
                // holds only while the request actually omits the field.
                expect(query.has(name)).toBe(false)
            } else {
                expect(query.get(name)).toBe(schemaDefault)
            }
        }
    )
})
