import { useConfig } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import { AdminDhis2PublicBaseUrl, adminGetDhis2PublicBaseUrl } from '../api/admin'

/** The reports' public DHIS2 address; `null` while loading or not asked for, `error` set when the fetch fails. */
export interface Dhis2PublicBaseUrlState {
    address: AdminDhis2PublicBaseUrl | null
    error: Error | null
}

/**
 * Fetches the address the reporting service builds the reports' links to
 * DHIS2 on, when `enabled`: the endpoint is for administrators, so a form
 * passes whether the user is one, and nothing is fetched otherwise. A
 * response to a superseded request is dropped, however late it arrives.
 */
export const useDhis2PublicBaseUrl = (enabled: boolean): Dhis2PublicBaseUrlState => {
    const { baseUrl } = useConfig()
    const [address, setAddress] = useState<AdminDhis2PublicBaseUrl | null>(null)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        setAddress(null)
        setError(null)
        if (!enabled) return
        let cancelled = false
        adminGetDhis2PublicBaseUrl(baseUrl)
            .then((loaded) => {
                if (!cancelled) setAddress(loaded)
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
            })
        return () => {
            cancelled = true
        }
    }, [baseUrl, enabled])

    return { address, error }
}
