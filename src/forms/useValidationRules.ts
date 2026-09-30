import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import { loadValidationRules, ValidationRule } from '../api/reportConfig'
import { languageSubtag } from './reportLocale'

/** The Validation Report's rules; `null` while loading, `error` set when the fetch fails. */
export interface ValidationRulesState {
    rules: ValidationRule[] | null
    error: Error | null
}

/**
 * Fetches the Validation Report's rule catalogue on mount, and again when
 * the DHIS2 base URL or the interface language changes, with the summaries
 * in the interface language where the report carries them and in English
 * otherwise. A response to a superseded request is dropped, however late it
 * arrives.
 */
export const useValidationRules = (): ValidationRulesState => {
    const { baseUrl } = useConfig()
    const language = languageSubtag(i18n.language)
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
