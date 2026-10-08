import i18n from '@dhis2/d2-i18n'
import type { AdminResourceMetadata } from '../api/admin'
import type { AdminResourceType } from './AdminResourceType'

/**
 * Backend wire shape from
 * {@link NeoIPC.Reporting.Resources.AdminValidationExceptionMetadata}.
 */
export type AdminValidationExceptionMetadata = AdminResourceMetadata

export const validationExceptionsResource: AdminResourceType<AdminValidationExceptionMetadata> =
    {
        segment: 'validation-exceptions',
        title: () => i18n.t('Validation exceptions'),
        singular: () => i18n.t('validation exception file'),
        plural: () => i18n.t('Validation exception files'),
        // The service checks the content with neoipcr's reader, which reads
        // a CSV file, whatever the type the browser detected; it records that
        // type on the sidecar.
        accept: '.csv,text/csv',
        uploadContentType: null,
        displayNameHelp: () =>
            i18n.t(
                'A label for administrators. The reports apply the stored list without showing its name.'
            ),
        extraColumns: [],
    }
