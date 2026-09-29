import { PresetOverrides } from '../api/reportConfig'
import { includeElementKeys } from './enums'

/**
 * The content fields a preset governs: the `includeX` figure/table
 * flags plus the confidence-interval mode and the two section-text
 * toggles. While a non-Custom preset is selected, the form locks these
 * controls; "Custom" unlocks them. Shared by both report forms (the
 * Reference form ignores the keys it doesn't expose — but it exposes all
 * of these).
 */
export const governedKeys = [
    ...includeElementKeys,
    'confidenceIntervals',
    'includeIntroductionTexts',
    'includeMethodsTexts',
] as const

/**
 * Resolve a preset to the governed-field values to apply, as
 * `defaults ⊕ overrides` (a preset lists only the params that differ
 * from the QMD defaults). The preset's `includeConfidenceIntervals`
 * override key (the QMD param name) maps onto the form's
 * `confidenceIntervals` field; every other override key already matches
 * its form-field name.
 */
export const resolvePresetValues = (
    overrides: PresetOverrides,
    governedDefaults: Record<string, boolean | string>
): Record<string, boolean | string> => {
    const result: Record<string, boolean | string> = { ...governedDefaults }
    for (const [key, value] of Object.entries(overrides)) {
        const field =
            key === 'includeConfidenceIntervals' ? 'confidenceIntervals' : key
        result[field] = value
    }
    return result
}
