import type { PartnerReportFormValues } from '../forms/PartnerReportForm'
import type { ReferenceReportFormValues } from '../forms/ReferenceReportForm'
import type { ValidationReportFormValues } from '../forms/ValidationReportForm'
import {
    buildPartnerReportQuery,
    buildReferenceReportQuery,
    buildValidationReportQuery,
    renderPartnerReport,
    renderReferenceReport,
    renderValidationReport,
} from './reports'

const partnerValues = (
    overrides: Partial<PartnerReportFormValues> = {}
): PartnerReportFormValues => ({
    mode: 'online',
    dataFile: null,
    referenceDataFile: '',
    unitCodes: [],
    reportingPeriodFrom: '',
    reportingPeriodTo: '',
    birthWeightFrom: null,
    birthWeightTo: null,
    gestationalAgeFrom: null,
    gestationalAgeTo: null,
    includeNonCorePatients: false,
    includeTestData: false,
    sparseDataThreshold: null,
    confidenceIntervals: '',
    includeIntroductionTexts: true,
    includeMethodsTexts: true,
    includeOutlierInterpretation: true,
    includeValidationSummaryTable: false,
    includeBirthWeightFigure: false,
    includeGestationalAgeFigure: false,
    includeIncidenceDensityTable: false,
    includeDeviceAssociatedIncidenceDensityTable: false,
    includeAgentPerInfectionRateTable: false,
    includeInfectiousAgentDetectionRateTable: false,
    includeRiskDensityRateTable: false,
    includeAntibioticUtilisationTable: false,
    includeSurgicalProcedureRateTable: false,
    includeResistantPathogenInfectionRateTable: false,
    includeOrganismResistanceRateTable: false,
    includeAntibioticResistanceTestRateTable: false,
    includeSecondaryBsiRateTable: false,
    locale: '',
    outputFormat: 'html',
    ...overrides,
})

const referenceValues = (
    overrides: Partial<ReferenceReportFormValues> = {}
): ReferenceReportFormValues => ({
    referenceDataId: '',
    reportingPeriodFrom: '',
    reportingPeriodTo: '',
    birthWeightFrom: null,
    birthWeightTo: null,
    gestationalAgeFrom: null,
    gestationalAgeTo: null,
    countryFilter: [],
    departmentFilter: [],
    testUnitFilter: null,
    defaultPatientFilter: null,
    sparseDataThreshold: null,
    confidenceIntervals: '',
    includeIntroductionTexts: true,
    includeMethodsTexts: true,
    includeValidationSummaryTable: false,
    includeBirthWeightFigure: false,
    includeGestationalAgeFigure: false,
    includeIncidenceDensityTable: false,
    includeDeviceAssociatedIncidenceDensityTable: false,
    includeAgentPerInfectionRateTable: false,
    includeInfectiousAgentDetectionRateTable: false,
    includeRiskDensityRateTable: false,
    includeAntibioticUtilisationTable: false,
    includeSurgicalProcedureRateTable: false,
    includeResistantPathogenInfectionRateTable: false,
    includeOrganismResistanceRateTable: false,
    includeAntibioticResistanceTestRateTable: false,
    includeSecondaryBsiRateTable: false,
    locale: '',
    outputFormat: 'html',
    ...overrides,
})

describe('buildPartnerReportQuery', () => {
    it('online mode: includes live-fetch filters and drops empty/null values', () => {
        const qs = buildPartnerReportQuery(
            partnerValues({
                mode: 'online',
                unitCodes: ['DEP_A', 'DEP_B'],
                reportingPeriodFrom: '2025-01-01',
                reportingPeriodTo: '2025-12-31',
                birthWeightFrom: 500,
                includeTestData: true,
            }),
            'pdf'
        )

        expect(qs.getAll('unitCodes')).toEqual(['DEP_A', 'DEP_B'])
        expect(qs.get('reportingPeriodFrom')).toBe('2025-01-01')
        expect(qs.get('reportingPeriodTo')).toBe('2025-12-31')
        expect(qs.get('birthWeightFrom')).toBe('500')
        // birthWeightTo stayed null → dropped, not sent as an empty sentinel
        expect(qs.has('birthWeightTo')).toBe(false)
        // empty strings dropped
        expect(qs.has('referenceDataFile')).toBe(false)
        // booleans are always emitted, including `false`
        expect(qs.get('includeTestData')).toBe('true')
        expect(qs.get('includeNonCorePatients')).toBe('false')
        expect(qs.get('includeIntroductionTexts')).toBe('true')
    })

    it('dataFile mode: omits the live-fetch filters even when populated', () => {
        const qs = buildPartnerReportQuery(
            partnerValues({
                mode: 'dataFile',
                referenceDataFile: 'ref-123',
                unitCodes: ['DEP_A'],
                reportingPeriodFrom: '2025-01-01',
                birthWeightFrom: 500,
                includeTestData: true,
            }),
            'html'
        )

        // base params still present
        expect(qs.get('referenceDataFile')).toBe('ref-123')
        // the backend ignores these in dataFile mode → never sent
        expect(qs.has('unitCodes')).toBe(false)
        expect(qs.has('reportingPeriodFrom')).toBe(false)
        expect(qs.has('birthWeightFrom')).toBe(false)
        expect(qs.has('includeTestData')).toBe(false)
        expect(qs.has('includeNonCorePatients')).toBe(false)
    })

    it('emits each includeX content flag as a boolean', () => {
        const qs = buildPartnerReportQuery(
            partnerValues({
                includeBirthWeightFigure: true,
                includeSecondaryBsiRateTable: false,
            }),
            'pdf'
        )

        expect(qs.get('includeBirthWeightFigure')).toBe('true')
        expect(qs.get('includeSecondaryBsiRateTable')).toBe('false')
        // The report shows its validation summary when the flag is absent, so
        // an unchecked box has to go out as `false` to take the table away.
        expect(qs.get('includeValidationSummaryTable')).toBe('false')
    })

    it('drops confidenceIntervals when unset, includes it when chosen', () => {
        expect(
            buildPartnerReportQuery(partnerValues(), 'pdf').has(
                'confidenceIntervals'
            )
        ).toBe(false)
        expect(
            buildPartnerReportQuery(
                partnerValues({ confidenceIntervals: 'rate' }),
                'pdf'
            ).get('confidenceIntervals')
        ).toBe('rate')
    })

    it('emits a numeric zero rather than dropping it as falsy', () => {
        const qs = buildPartnerReportQuery(
            partnerValues({ sparseDataThreshold: 0 }),
            'pdf'
        )
        expect(qs.get('sparseDataThreshold')).toBe('0')
    })

    it('appends fragmentMode only for the html format', () => {
        expect(
            buildPartnerReportQuery(partnerValues(), 'html').get('fragmentMode')
        ).toBe('true')
        expect(
            buildPartnerReportQuery(partnerValues(), 'pdf').has('fragmentMode')
        ).toBe(false)
        // fragmentMode asks for a body-only HTML fragment, which is meaningless
        // for a dataset download — and sending it would make the request differ
        // from the one the upload path's own bytes came from.
        expect(
            buildPartnerReportQuery(partnerValues(), 'json').has('fragmentMode')
        ).toBe(false)
    })

    it('carries the live-fetch filters for the json dataset', () => {
        // JSON is produced from the online path only, so the filters that
        // choose the cohort have to reach it exactly as they reach a render:
        // a dataset built from a different cohort than the report it backs
        // would round-trip cleanly and still be wrong.
        const qs = buildPartnerReportQuery(
            partnerValues({
                unitCodes: ['AT_TEST_TEST'],
                reportingPeriodFrom: '2020-01-01',
                reportingPeriodTo: '2030-12-31',
            }),
            'json'
        )

        expect(qs.getAll('unitCodes')).toEqual(['AT_TEST_TEST'])
        expect(qs.get('reportingPeriodFrom')).toBe('2020-01-01')
        expect(qs.get('reportingPeriodTo')).toBe('2030-12-31')
    })
})

describe('buildReferenceReportQuery', () => {
    it('live mode (no referenceDataId): includes the live-fetch filters', () => {
        const qs = buildReferenceReportQuery(
            referenceValues({
                reportingPeriodFrom: '2025-01-01',
                birthWeightFrom: 500,
                countryFilter: ['DE', 'FR'],
                testUnitFilter: false,
            }),
            'pdf'
        )

        expect(qs.get('reportingPeriodFrom')).toBe('2025-01-01')
        expect(qs.get('birthWeightFrom')).toBe('500')
        expect(qs.getAll('countryFilter')).toEqual(['DE', 'FR'])
        expect(qs.get('testUnitFilter')).toBe('false')
        // defaultPatientFilter stayed null → dropped (backend default)
        expect(qs.has('defaultPatientFilter')).toBe(false)
    })

    it('saved-dataset mode (referenceDataId set): skips live-fetch filters but keeps content flags', () => {
        const qs = buildReferenceReportQuery(
            referenceValues({
                referenceDataId: 'DS123',
                reportingPeriodFrom: '2025-01-01',
                birthWeightFrom: 500,
                countryFilter: ['DE'],
                departmentFilter: ['AT_TEST_TEST'],
                testUnitFilter: true,
                defaultPatientFilter: true,
                includeIncidenceDensityTable: true,
            }),
            'pdf'
        )

        expect(qs.get('referenceDataId')).toBe('DS123')
        // no mixed mode: live-fetch filters are suppressed
        expect(qs.has('reportingPeriodFrom')).toBe(false)
        expect(qs.has('birthWeightFrom')).toBe(false)
        expect(qs.has('countryFilter')).toBe(false)
        expect(qs.has('departmentFilter')).toBe(false)
        expect(qs.has('testUnitFilter')).toBe(false)
        expect(qs.has('defaultPatientFilter')).toBe(false)
        // content flags are not live-fetch filters → still sent
        expect(qs.get('includeIncidenceDensityTable')).toBe('true')
        expect(qs.get('includeValidationSummaryTable')).toBe('false')
    })

    it('emits includeX content flags and fragmentMode for html', () => {
        const qs = buildReferenceReportQuery(
            referenceValues({
                includeBirthWeightFigure: true,
                includeSecondaryBsiRateTable: false,
            }),
            'html'
        )

        expect(qs.get('includeBirthWeightFigure')).toBe('true')
        expect(qs.get('includeSecondaryBsiRateTable')).toBe('false')
        expect(qs.get('fragmentMode')).toBe('true')
    })
})

describe('renderPartnerReport', () => {
    const realFetch = global.fetch
    afterEach(() => {
        global.fetch = realFetch
        jest.restoreAllMocks()
    })

    it('rejects in dataFile mode when no file was selected, without calling fetch', async () => {
        const fetchMock = jest.fn()
        global.fetch = fetchMock as unknown as typeof fetch

        await expect(
            renderPartnerReport(
                'https://dhis.example',
                partnerValues({ mode: 'dataFile', dataFile: null })
            )
        ).rejects.toThrow(/data file/i)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('renderReferenceReport', () => {
    const realFetch = global.fetch
    afterEach(() => {
        global.fetch = realFetch
        jest.restoreAllMocks()
    })

    it('GETs the fragment endpoint and returns the decoded html on the html path', async () => {
        const htmlResponse = {
            ok: true,
            status: 200,
            text: async () => '<h1>Report</h1>',
        } as unknown as Response
        const fetchMock = jest.fn().mockResolvedValue(htmlResponse)
        global.fetch = fetchMock as unknown as typeof fetch

        const result = await renderReferenceReport(
            'https://dhis.example',
            referenceValues({ outputFormat: 'html' })
        )

        expect(result).toEqual({ format: 'html', fragmentHtml: '<h1>Report</h1>' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain('https://dhis.example/neoipc/api/reference-report?')
        expect(url).toContain('fragmentMode=true')
        expect(init).toMatchObject({ method: 'GET' })
    })
})

const validationValues = (
    overrides: Partial<ValidationReportFormValues> = {}
): ValidationReportFormValues => ({
    departmentFilter: [],
    rules: null,
    includeTestData: false,
    locale: '',
    outputFormat: 'html',
    ...overrides,
})

describe('buildValidationReportQuery', () => {
    it('leaves rules out when every rule is selected', () => {
        const qs = buildValidationReportQuery(validationValues(), 'html')
        expect(qs.has('rules')).toBe(false)
        expect(qs.get('includeTestData')).toBe('false')
        expect(qs.get('fragmentMode')).toBe('true')
    })

    it('sends a selection of rules as repeated keys, and the departments', () => {
        const qs = buildValidationReportQuery(
            validationValues({
                rules: [3, 25],
                departmentFilter: ['AT_TEST_TEST', 'CH_TEST_TEST'],
                includeTestData: true,
                locale: 'de',
            }),
            'pdf'
        )
        expect(qs.getAll('rules')).toEqual(['3', '25'])
        expect(qs.getAll('departmentFilter')).toEqual(['AT_TEST_TEST', 'CH_TEST_TEST'])
        expect(qs.get('includeTestData')).toBe('true')
        expect(qs.get('locale')).toBe('de')
        expect(qs.has('fragmentMode')).toBe(false)
    })
})

describe('renderValidationReport', () => {
    const realFetch = global.fetch
    afterEach(() => {
        global.fetch = realFetch
        jest.restoreAllMocks()
    })

    it('rejects an empty rule selection without calling fetch', async () => {
        const fetchMock = jest.fn()
        global.fetch = fetchMock as unknown as typeof fetch

        await expect(
            renderValidationReport('https://dhis.example', validationValues({ rules: [] }))
        ).rejects.toThrow(/validation rule/i)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('GETs the validation-report endpoint with the Accept header of the format', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '<h1>Validation</h1>',
        } as unknown as Response)
        global.fetch = fetchMock as unknown as typeof fetch

        const result = await renderValidationReport(
            'https://dhis.example',
            validationValues({ rules: [25] })
        )

        expect(result).toEqual({ format: 'html', fragmentHtml: '<h1>Validation</h1>' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain('https://dhis.example/neoipc/api/validation-report?')
        expect(url).toContain('rules=25')
        expect(init).toMatchObject({ method: 'GET', headers: { Accept: 'text/html' } })
    })
})
