import i18n from '@dhis2/d2-i18n'
import React, { FC } from 'react'
import { renderValidationReport } from '../../api/reports'
import ValidationReportForm, {
    ValidationReportFormValues,
} from '../../forms/ValidationReportForm'
import ReportResultPanel from '../../render/ReportResultPanel'
import { useReportRender } from '../../render/useReportRender'

const ValidationReportPage: FC = () => {
    const render = useReportRender<ValidationReportFormValues>(renderValidationReport)
    return (
        <>
            <h1>{i18n.t('Validation Report')}</h1>
            <ValidationReportForm onSubmit={render.submit} submitting={render.loading} />
            <ReportResultPanel
                loading={render.loading}
                elapsedSeconds={render.elapsedSeconds}
                fragmentHtml={render.result?.fragmentHtml ?? null}
                error={render.error}
            />
        </>
    )
}

export default ValidationReportPage
