import {
    IconArchive24,
    IconCheckmarkCircle24,
    IconFileDocument24,
    IconFlag24,
    IconWorld24,
} from '@dhis2/ui'
import i18n from '@dhis2/d2-i18n'
import React, { LazyExoticComponent, ReactElement, ComponentType } from 'react'
import type { AppAuthority } from '../authority/Authority'

/**
 * One entry in the left-nav. Order in the rendered menu is given by
 * {@link categoryOrder}; this map provides the per-entry metadata.
 *
 * `Page` is a `React.lazy` component so the per-page bundle is split
 * out of the initial download. Mount it under a `<Suspense>` boundary
 * (see `ContentArea`).
 */
export interface MenuCategory {
    /** Hash-route segment, also the React key. */
    id: string
    /** i18n-localised left-nav label. Evaluated on render so locale
     *  switches re-translate the menu. */
    label: () => string
    /** `@dhis2/ui` icon element to render in the menu item. */
    icon: ReactElement
    /** Authority required to see this category; `null` = always shown. */
    requiredAuthority: AppAuthority | null
    /** Lazy-loaded page component for this route. */
    Page: LazyExoticComponent<ComponentType>
}

export const categoryOrder = [
    'reports/partner',
    'reports/reference',
    'reports/validation',
    'admin/reference-data',
    'admin/validation-exceptions',
] as const

export type CategoryId = (typeof categoryOrder)[number]

export const categories: Record<CategoryId, MenuCategory> = {
    'reports/partner': {
        id: 'reports/partner',
        label: () => i18n.t('Partner Report'),
        icon: <IconFileDocument24 />,
        requiredAuthority: 'F_NEOIPC_REPORT',
        Page: React.lazy(() => import('../pages/reports/PartnerReportPage')),
    },
    'reports/reference': {
        id: 'reports/reference',
        label: () => i18n.t('Reference Report'),
        icon: <IconWorld24 />,
        requiredAuthority: 'F_NEOIPC_REPORT',
        Page: React.lazy(() => import('../pages/reports/ReferenceReportPage')),
    },
    'reports/validation': {
        id: 'reports/validation',
        label: () => i18n.t('Validation Report'),
        icon: <IconFlag24 />,
        requiredAuthority: 'F_NEOIPC_REPORT',
        Page: React.lazy(() => import('../pages/reports/ValidationReportPage')),
    },
    'admin/reference-data': {
        id: 'admin/reference-data',
        label: () => i18n.t('Reference data'),
        icon: <IconArchive24 />,
        requiredAuthority: 'F_NEOIPC_ADMIN',
        Page: React.lazy(() => import('../pages/admin/ReferenceDataPage')),
    },
    'admin/validation-exceptions': {
        id: 'admin/validation-exceptions',
        label: () => i18n.t('Validation exceptions'),
        icon: <IconCheckmarkCircle24 />,
        requiredAuthority: 'F_NEOIPC_ADMIN',
        Page: React.lazy(() => import('../pages/admin/ValidationExceptionsPage')),
    },
}

/**
 * Filter the category list by the user's authorities. The DHIS2
 * `ALL` superuser authority is honoured implicitly via
 * {@link import('../authority/useAuthorities').useAuthorities}.
 */
export const visibleCategories = (
    has: (authority: AppAuthority) => boolean
): MenuCategory[] =>
    categoryOrder
        .map((id) => categories[id])
        .filter(
            (category) =>
                category.requiredAuthority === null ||
                has(category.requiredAuthority)
        )
