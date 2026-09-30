import { CalendarInput } from '@dhis2/ui'
import React, { FC } from 'react'

interface DateFieldProps {
    name: string
    label: string
    helpText?: string
    /** ISO date string (`YYYY-MM-DD`), or empty string for no selection. */
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    required?: boolean
    /** Mark the field invalid (red) with an inline message. */
    error?: boolean
    validationText?: string
}

/**
 * Date picker that emits an ISO `YYYY-MM-DD` string, matching the wire
 * format for the backend's `DateOnly` parameters
 * (`ReportingPeriodFrom`, `ReportingPeriodTo`, etc.). Wraps
 * `@dhis2/ui`'s `CalendarInput` which calls `onDateSelect` with
 * `null` for "cleared" or `{ calendarDateString: 'YYYY-MM-DD' }` for
 * a selection — we normalize both to a plain string.
 */
const DateField: FC<DateFieldProps> = ({
    name,
    label,
    helpText,
    value,
    onChange,
    disabled,
    required,
    error,
    validationText,
}) => (
    <CalendarInput
        name={name}
        label={label}
        helpText={helpText}
        calendar="gregory"
        format="YYYY-MM-DD"
        clearable
        date={value}
        onDateSelect={(payload) =>
            onChange(payload?.calendarDateString ?? '')
        }
        disabled={disabled}
        required={required}
        error={error}
        validationText={error ? validationText : undefined}
    />
)

export default DateField
