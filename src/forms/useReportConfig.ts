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
 * and the supported locale tags. `null` while loading; `error` set when
 * a fetch fails (the form degrades to no presets / no locale choices).
 */
export interface ReportConfig {
    presets: PresetMap | null
    locales: string[] | null
    error: Error | null
}

/** What {@link useReportConfig} fetches besides the locales. */
export interface ReportConfigOptions {
    /** Fetch the content presets; `false` for a report that has none, whose
     *  presets endpoint does not exist. Defaults to `true`. */
    presets?: boolean
}

/**
 * Fetches a report's presets + locales once on mount (and when the
 * report or DHIS2 base URL changes). Used by the report forms to drive
 * the preset selector and the locale picker. With `presets: false`,
 * `presets` stays `null` and only the locales are fetched.
 */
export const useReportConfig = (
    report: ReportSegment,
    { presets: withPresets = true }: ReportConfigOptions = {}
): ReportConfig => {
    const { baseUrl } = useConfig()
    const [presets, setPresets] = useState<PresetMap | null>(null)
    const [locales, setLocales] = useState<string[] | null>(null)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        let cancelled = false
        setPresets(null)
        setLocales(null)
        setError(null)
        Promise.all([
            withPresets ? loadPresets(baseUrl, report) : Promise.resolve(null),
            loadLocales(baseUrl, report),
        ])
            .then(([p, l]) => {
                if (cancelled) return
                setPresets(p)
                setLocales(l)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                setError(err instanceof Error ? err : new Error(String(err)))
            })
        return () => {
            cancelled = true
        }
    }, [baseUrl, report, withPresets])

    return { presets, locales, error }
}
