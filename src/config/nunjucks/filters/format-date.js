import { format, isDate, parseISO } from 'date-fns'
import { cy } from 'date-fns/locale'

export function formatDate(
  value,
  formattedDateStr = 'EEE do MMMM yyyy',
  currentLocale = 'en'
) {
  if (value == null) {
    return ''
  }
  const date = isDate(value) ? value : parseISO(value)

  return format(
    date,
    formattedDateStr,
    currentLocale === 'cy' ? { locale: cy } : undefined
  )
}
