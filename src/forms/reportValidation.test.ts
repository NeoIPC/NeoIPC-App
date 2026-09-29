import type { PartnerReportFormValues } from './PartnerReportForm'
import type { ReferenceReportFormValues } from './ReferenceReportForm'
import type { ValidationReportFormValues } from './ValidationReportForm'
import {
    hasErrors,
    validatePartnerReport,
    validateReferenceReport,
    validateValidationReport,
} from './reportValidation'

const makePartner = (
    over: Partial<PartnerReportFormValues> = {}
): PartnerReportFormValues => ({
    mode: 'online',
    dataFile: null,
    referenceDataFile: '',
    unitCodes: ['AT_DEPT'],
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
    includeOutlierInterpretation: false,
    includeBirthWeightFigure: true,
    includeGestationalAgeFigure: true,
    includeIncidenceDensityTable: true,
    includeDeviceAssociatedIncidenceDensityTable: true,
    includeAgentPerInfectionRateTable: true,
    includeInfectiousAgentDetectionRateTable: true,
    includeRiskDensityRateTable: true,
    includeAntibioticUtilisationTable: false,
    includeSurgicalProcedureRateTable: true,
    includeResistantPathogenInfectionRateTable: false,
    includeOrganismResistanceRateTable: false,
    includeAntibioticResistanceTestRateTable: false,
    includeSecondaryBsiRateTable: false,
    locale: '',
    outputFormat: 'html',
    ...over,
})

const makeReference = (
    over: Partial<ReferenceReportFormValues> = {}
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
    includeBirthWeightFigure: true,
    includeGestationalAgeFigure: true,
    includeIncidenceDensityTable: true,
    includeDeviceAssociatedIncidenceDensityTable: true,
    includeAgentPerInfectionRateTable: true,
    includeInfectiousAgentDetectionRateTable: true,
    includeRiskDensityRateTable: true,
    includeAntibioticUtilisationTable: false,
    includeSurgicalProcedureRateTable: true,
    includeResistantPathogenInfectionRateTable: false,
    includeOrganismResistanceRateTable: false,
    includeAntibioticResistanceTestRateTable: false,
    includeSecondaryBsiRateTable: false,
    locale: '',
    outputFormat: 'html',
    ...over,
})

describe('hasErrors', () => {
    it('is false for an empty error map', () => {
        expect(hasErrors({})).toBe(false)
    })
    it('is true when any field carries a message', () => {
        expect(hasErrors({ unitCodes: 'x' })).toBe(true)
    })
})

describe('validatePartnerReport', () => {
    it('requires at least one department in online mode', () => {
        const errors = validatePartnerReport(makePartner({ unitCodes: [] }))
        expect(errors.unitCodes).toBeTruthy()
    })

    it('accepts a non-empty department selection in online mode', () => {
        const errors = validatePartnerReport(
            makePartner({ unitCodes: ['AT_DEPT'] })
        )
        expect(errors.unitCodes).toBeUndefined()
    })

    it('requires a file in dataFile mode', () => {
        const errors = validatePartnerReport(
            makePartner({ mode: 'dataFile', dataFile: null, unitCodes: [] })
        )
        expect(errors.dataFile).toBeTruthy()
        // Departments are not required in dataFile mode.
        expect(errors.unitCodes).toBeUndefined()
    })

    it('accepts a chosen file in dataFile mode', () => {
        const file = new File(['{}'], 'data.json', {
            type: 'application/json',
        })
        const errors = validatePartnerReport(
            makePartner({ mode: 'dataFile', dataFile: file, unitCodes: [] })
        )
        expect(hasErrors(errors)).toBe(false)
    })

    it('flags an inverted birth-weight range in online mode', () => {
        const errors = validatePartnerReport(
            makePartner({ birthWeightFrom: 2000, birthWeightTo: 1000 })
        )
        expect(errors.birthWeight).toBeTruthy()
    })

    it('ignores a half-open range (only one end set)', () => {
        const errors = validatePartnerReport(
            makePartner({ birthWeightFrom: 2000, birthWeightTo: null })
        )
        expect(errors.birthWeight).toBeUndefined()
    })

    it('flags an inverted reporting period', () => {
        const errors = validatePartnerReport(
            makePartner({
                reportingPeriodFrom: '2025-06-01',
                reportingPeriodTo: '2025-01-01',
            })
        )
        expect(errors.reportingPeriod).toBeTruthy()
    })

    it('does not validate cohort ranges in dataFile mode', () => {
        const file = new File(['{}'], 'data.json')
        const errors = validatePartnerReport(
            makePartner({
                mode: 'dataFile',
                dataFile: file,
                birthWeightFrom: 2000,
                birthWeightTo: 1000,
            })
        )
        expect(errors.birthWeight).toBeUndefined()
    })

    it('passes a well-formed online form', () => {
        expect(hasErrors(validatePartnerReport(makePartner()))).toBe(false)
    })
})

describe('validateReferenceReport', () => {
    it('flags an inverted range when computing live from filters', () => {
        const errors = validateReferenceReport(
            makeReference({ birthWeightFrom: 2000, birthWeightTo: 1000 })
        )
        expect(errors.birthWeight).toBeTruthy()
    })

    it('skips cohort validation when a saved dataset is selected', () => {
        const errors = validateReferenceReport(
            makeReference({
                referenceDataId: 'saved-1',
                birthWeightFrom: 2000,
                birthWeightTo: 1000,
            })
        )
        expect(hasErrors(errors)).toBe(false)
    })

    it('passes a well-formed live-fetch form', () => {
        expect(hasErrors(validateReferenceReport(makeReference()))).toBe(false)
    })
})

describe('validateValidationReport', () => {
    const makeValidation = (
        over: Partial<ValidationReportFormValues> = {}
    ): ValidationReportFormValues => ({
        departmentFilter: [],
        rules: null,
        includeTestData: false,
        locale: '',
        outputFormat: 'html',
        ...over,
    })

    it('flags a selection of no rule', () => {
        expect(validateValidationReport(makeValidation({ rules: [] })).rules).toBeTruthy()
    })

    it('passes every rule and a selection of some', () => {
        expect(hasErrors(validateValidationReport(makeValidation()))).toBe(false)
        expect(hasErrors(validateValidationReport(makeValidation({ rules: [25] })))).toBe(false)
    })
})
