import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import {
    Button,
    Card,
    CircularLoader,
    FileInput,
    InputField,
    NoticeBox,
} from '@dhis2/ui'
import React, { FC, useCallback, useEffect, useState } from 'react'
import {
    AdminResourceMetadata,
    adminDeleteSingle,
    adminGetSingle,
    adminPutSingle,
} from '../api/admin'
import { enrichError } from '../api/problemDetails'
import { AdminResourceType } from './AdminResourceType'
import { formatBytes, formatDate } from './adminFormat'

interface AdminSingletonPageProps<T extends AdminResourceMetadata> {
    resource: AdminResourceType<T>
}

/**
 * Admin page for a **singleton** resource — one file at a time, against
 * the no-id `GET` (current metadata) / `PUT` (upload-replace) / `DELETE`
 * API (e.g. the validation-exception file). Shows the current file's
 * metadata (or "none uploaded"), an upload form that replaces it, and a
 * remove button. The list-based {@link AdminListPage} is for collection
 * resources (reference data); this is its singleton sibling.
 */
function AdminSingletonPage<T extends AdminResourceMetadata>({
    resource,
}: AdminSingletonPageProps<T>): ReturnType<FC> {
    const { baseUrl } = useConfig()
    // `undefined` = loading; `null` = none uploaded; `T` = current file.
    const [item, setItem] = useState<T | null | undefined>(undefined)
    const [loadError, setLoadError] = useState<Error | null>(null)
    const [actionError, setActionError] = useState<Error | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [displayName, setDisplayName] = useState('')
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const reload = useCallback(async () => {
        setLoadError(null)
        try {
            setItem(await adminGetSingle<T>(baseUrl, resource.segment))
        } catch (err) {
            setLoadError(await enrichError(err))
            setItem(null)
        }
    }, [baseUrl, resource.segment])

    useEffect(() => {
        void reload()
    }, [reload])

    const onUpload = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!file) return
        setUploading(true)
        setActionError(null)
        try {
            const saved = await adminPutSingle<T>(
                baseUrl,
                resource.segment,
                file,
                displayName,
                resource.uploadContentType
            )
            setItem(saved)
            setFile(null)
            setDisplayName('')
        } catch (err) {
            setActionError(await enrichError(err))
        } finally {
            setUploading(false)
        }
    }

    const onDelete = async () => {
        setDeleting(true)
        setActionError(null)
        try {
            await adminDeleteSingle(baseUrl, resource.segment)
            setItem(null)
        } catch (err) {
            setActionError(await enrichError(err))
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <h1>{resource.title()}</h1>

            <Card>
                <h2>{i18n.t('Current file')}</h2>
                {loadError && (
                    <NoticeBox error title={i18n.t('Failed to load')}>
                        {loadError.message}
                    </NoticeBox>
                )}
                {item === undefined ? (
                    <CircularLoader />
                ) : item === null ? (
                    <p>
                        {i18n.t('No {{singular}} uploaded.', {
                            singular: resource.singular(),
                        })}
                    </p>
                ) : (
                    <>
                        <p>
                            <strong>{item.displayName}</strong>
                            {' — '}
                            {formatBytes(item.sizeBytes)}
                            {', '}
                            {i18n.t('uploaded {{when}}', {
                                when: formatDate(item.createdAt),
                            })}
                        </p>
                        <Button
                            small
                            destructive
                            disabled={deleting}
                            loading={deleting}
                            onClick={onDelete}
                        >
                            {i18n.t('Remove')}
                        </Button>
                    </>
                )}
            </Card>

            <Card>
                <h2>{item ? i18n.t('Replace') : i18n.t('Upload')}</h2>
                {actionError && (
                    <NoticeBox error title={i18n.t('Action failed')}>
                        {/* A refused validation-exception list's reason is
                            the service's check's message, one line per point
                            it makes. */}
                        <span style={{ whiteSpace: 'pre-line' }}>{actionError.message}</span>
                    </NoticeBox>
                )}
                <form onSubmit={onUpload}>
                    <InputField
                        name="displayName"
                        label={i18n.t('Display name')}
                        helpText={
                            resource.displayNameHelp?.() ??
                            i18n.t('Optional; blank uses a timestamp-based default.')
                        }
                        value={displayName}
                        onChange={({ value }) => setDisplayName(value ?? '')}
                    />
                    <FileInput
                        name="file"
                        buttonLabel={i18n.t('Choose file')}
                        accept={resource.accept}
                        onChange={({ files }) => setFile(files?.[0] ?? null)}
                        disabled={uploading}
                    />
                    <Button
                        primary
                        type="submit"
                        disabled={file === null || uploading}
                        loading={uploading}
                    >
                        {item ? i18n.t('Replace') : i18n.t('Upload')}
                    </Button>
                </form>
            </Card>
        </>
    )
}

export default AdminSingletonPage
