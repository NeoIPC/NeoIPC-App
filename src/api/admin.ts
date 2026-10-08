import {
    fetchNeoipcReporting,
    neoipcReportingUrl,
    NeoipcReportingError,
} from './neoipcReporting'

/**
 * Fields every admin-listed resource exposes. Backend equivalents:
 *  - {@link NeoIPC.Reporting.Resources.AdminReferenceDataMetadata}
 *  - {@link NeoIPC.Reporting.Resources.AdminValidationExceptionMetadata}
 *
 * Resource-specific fields are layered on top via a generic `T` in
 * {@link AdminResourceType}.
 */
export interface AdminResourceMetadata {
    id: string
    displayName: string
    sizeBytes: number
    contentType: string
    uploaderUserId: string | null
    createdAt: string
}

const adminPath = (segment: string, id?: string): string => {
    const base = `/admin/${segment}`
    return id ? `${base}/${encodeURIComponent(id)}` : base
}

/**
 * `GET /admin/<segment>` — full admin listing including upload-
 * bookkeeping fields (size, content type, uploader). The backend's
 * {@link camelCase} JSON naming policy maps cleanly onto `T`.
 */
export const adminList = async <T extends AdminResourceMetadata>(
    baseUrl: string,
    segment: string
): Promise<T[]> => {
    const response = await fetchNeoipcReporting(baseUrl, adminPath(segment), {
        method: 'GET',
        headers: { Accept: 'application/json' },
    })
    return (await response.json()) as T[]
}

/**
 * `POST /admin/<segment>?displayName=<encoded>` — stages the file body,
 * runs the resource-specific metadata extractor on the backend, and
 * (on success) returns 201 with the new {@link T} metadata.
 *
 * `contentType` overrides the file's auto-detected MIME — required for
 * reference-data, which the reporting service refuses with 415 unless the
 * request carries `Content-Type: application/json`. Pass `null` to let the
 * browser send the file's own type — the validation-exception endpoint
 * accepts any type and checks the content itself.
 */
export const adminUpload = async <T extends AdminResourceMetadata>(
    baseUrl: string,
    segment: string,
    file: File,
    displayName: string,
    contentType: string | null
): Promise<T> => {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': contentType ?? (file.type || 'application/octet-stream'),
    }
    const qs = new URLSearchParams()
    if (displayName !== '') qs.append('displayName', displayName)
    const suffix = qs.toString() === '' ? '' : `?${qs.toString()}`
    const response = await fetchNeoipcReporting(
        baseUrl,
        `${adminPath(segment)}${suffix}`,
        {
            method: 'POST',
            headers,
            body: file,
        }
    )
    return (await response.json()) as T
}

/**
 * `DELETE /admin/<segment>/<id>`. 204 on success; 404 if the id was
 * already gone (we treat 404 as success on delete to keep the listing
 * UX idempotent against stale clicks).
 */
export const adminDelete = async (
    baseUrl: string,
    segment: string,
    id: string
): Promise<void> => {
    try {
        await fetchNeoipcReporting(baseUrl, adminPath(segment, id), {
            method: 'DELETE',
        })
    } catch (err) {
        if (err instanceof NeoipcReportingError && err.response.status === 404) {
            return
        }
        throw err
    }
}

/**
 * Open the admin download URL for a resource in a new browser tab.
 * The backend streams the raw stored file with the recorded content
 * type, and the session cookie carries over automatically.
 */
export const adminDownloadUrl = (
    baseUrl: string,
    segment: string,
    id: string
): string => neoipcReportingUrl(baseUrl, adminPath(segment, id))

// --- Singleton resources (one file at a time; no id segment) -----------
// The validation-exception file is a single stored resource, so its admin
// API is `GET` (current metadata, or 404) / `PUT` (upload-replace, refused
// with 400 when the file is not a valid list) / `DELETE` — see
// ValidationExceptionEndpoints.cs.

/**
 * `GET /admin/<segment>` for a singleton resource. Returns the current
 * metadata, or `null` when none has been uploaded (the backend's 404).
 */
export const adminGetSingle = async <T extends AdminResourceMetadata>(
    baseUrl: string,
    segment: string
): Promise<T | null> => {
    try {
        const response = await fetchNeoipcReporting(baseUrl, adminPath(segment), {
            method: 'GET',
            headers: { Accept: 'application/json' },
        })
        return (await response.json()) as T
    } catch (err) {
        if (err instanceof NeoipcReportingError && err.response.status === 404) {
            return null
        }
        throw err
    }
}

/**
 * `PUT /admin/<segment>?displayName=<encoded>` — idempotent
 * create-or-replace of the single stored file. Returns the new metadata.
 * `contentType` overrides the file's auto-detected MIME (pass `null` to
 * forward the file's own type).
 */
export const adminPutSingle = async <T extends AdminResourceMetadata>(
    baseUrl: string,
    segment: string,
    file: File,
    displayName: string,
    contentType: string | null
): Promise<T> => {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': contentType ?? (file.type || 'application/octet-stream'),
    }
    const qs = new URLSearchParams()
    if (displayName !== '') qs.append('displayName', displayName)
    const suffix = qs.toString() === '' ? '' : `?${qs.toString()}`
    const response = await fetchNeoipcReporting(
        baseUrl,
        `${adminPath(segment)}${suffix}`,
        {
            method: 'PUT',
            headers,
            body: file,
        }
    )
    return (await response.json()) as T
}

/**
 * Backend wire shape from {@link NeoIPC.Reporting.AdminDhis2PublicBaseUrl}:
 * the address the reports' links to DHIS2 are built on, as the reporting
 * service read it when it started.
 */
export interface AdminDhis2PublicBaseUrl {
    /** The base of the reports' links to DHIS2. */
    publicBaseUrl: string
    /** `true` when it is the configured public address; `false` when none is
     *  configured and the service links to the DHIS2 address it reads from. */
    configured: boolean
}

/** `GET /admin/dhis2-public-base-url`. */
export const adminGetDhis2PublicBaseUrl = async (
    baseUrl: string
): Promise<AdminDhis2PublicBaseUrl> => {
    const response = await fetchNeoipcReporting(baseUrl, '/admin/dhis2-public-base-url', {
        method: 'GET',
        headers: { Accept: 'application/json' },
    })
    return (await response.json()) as AdminDhis2PublicBaseUrl
}

/**
 * `DELETE /admin/<segment>` for a singleton resource. 404 (already
 * absent) is treated as success to keep the UX idempotent.
 */
export const adminDeleteSingle = async (
    baseUrl: string,
    segment: string
): Promise<void> => {
    try {
        await fetchNeoipcReporting(baseUrl, adminPath(segment), {
            method: 'DELETE',
        })
    } catch (err) {
        if (err instanceof NeoipcReportingError && err.response.status === 404) {
            return
        }
        throw err
    }
}
