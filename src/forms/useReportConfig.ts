import { useConfig } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import {
    loadLocales,
    loadPresets,
    PresetMap,
    ReportSegment,
} from '../api/reportConfig'

/**
 * Report-layer configuration a form needs: the content {@link PresetMap}
 * and the supported locale tags. The two are loaded independently, so a
 * failure of one leaves the other intact.
 */
export interface ReportConfig {
    /** `null` while loading, when loading failed, and for a report fetched
     *  with `presets: false`. */
    presets: PresetMap | null
    /** `null` while loading and when loading failed; `localesError` tells
     *  the two apart. */
    locales: string[] | null
    /** Why the presets failed to load; `null` otherwise. */
    presetsError: Error | null
    /** Why the locales failed to load; `null` otherwise. */
    localesError: Error | null
}

/** What {@link useReportConfig} fetches besides the locales. */
export interface ReportConfigOptions {
    /** Fetch the content presets; `false` for a report that has none, whose
     *  presets endpoint does not exist. Defaults to `true`. */
    presets?: boolean
}

const asError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)))

/**
 * Fetches a report's presets and locales once on mount (and when the
 * report or DHIS2 base URL changes). Used by the report forms to drive
 * the preset selector and the locale picker. The two requests are
 * independent: the locale list, which decides the language a report is
 * requested in, does not depend on the presets loading. With
 * `presets: false`, `presets` stays `null` and only the locales are fetched.
 */
export const useReportConfig = (
    report: ReportSegment,
    { presets: withPresets = true }: ReportConfigOptions = {}
): ReportConfig => {
    const { baseUrl } = useConfig()
    const [presets, setPresets] = useState<PresetMap | null>(null)
    const [locales, setLocales] = useState<string[] | null>(null)
    const [presetsError, setPresetsError] = useState<Error | null>(null)
    const [localesError, setLocalesError] = useState<Error | null>(null)

    useEffect(() => {
        let cancelled = false
        setPresets(null)
        setLocales(null)
        setPresetsError(null)
        setLocalesError(null)
        if (withPresets) {
            loadPresets(baseUrl, report).then(
                (loaded) => {
                    if (!cancelled) setPresets(loaded)
                },
                (err: unknown) => {
                    if (!cancelled) setPresetsError(asError(err))
                }
            )
        }
        loadLocales(baseUrl, report).then(
            (loaded) => {
                if (!cancelled) setLocales(loaded)
            },
            (err: unknown) => {
                if (!cancelled) setLocalesError(asError(err))
            }
        )
        return () => {
            cancelled = true
        }
    }, [baseUrl, report, withPresets])

    return { presets, locales, presetsError, localesError }
}
