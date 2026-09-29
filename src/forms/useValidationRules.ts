import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import { loadValidationRules, ValidationRule } from '../api/reportConfig'

/** The Validation Report's rules; `null` while loading, `error` set when the fetch fails. */
export interface ValidationRulesState {
    rules: ValidationRule[] | null
    error: Error | null
}

/**
 * Fetches the Validation Report's rule catalogue once on mount, with the
 * summaries in the app's interface language where the report carries them
 * and in English otherwise.
 */
export const useValidationRules = (): ValidationRulesState => {
    const { baseUrl } = useConfig()
    const language = (i18n.language ?? 'en').split(/[-_]/)[0].toLowerCase()
    const [rules, setRules] = useState<ValidationRule[] | null>(null)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        let cancelled = false
        setRules(null)
        setError(null)
        loadValidationRules(baseUrl, language)
            .then((loaded) => {
                if (!cancelled) setRules(loaded)
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
            })
        return () => {
            cancelled = true
        }
    }, [baseUrl, language])

    return { rules, error }
}
