export const FILE_UPLOAD_SESSION_KEY = 'fileUpload'

export const MATERIALS = [
  { value: 'Steel', text: 'Steel' },
  { value: 'Wood', text: 'Wood' },
  { value: 'Aluminium', text: 'Aluminium' },
  { value: 'Fibre', text: 'Fibre' },
  { value: 'Glass', text: 'Glass' },
  { value: 'Paper', text: 'Paper' },
  { value: 'Plastic', text: 'Plastic' }
]

export function getYearOptions() {
  const currentYear = new Date().getFullYear()
  return [currentYear - 2, currentYear - 1, currentYear].map((y) => ({
    value: String(y),
    text: String(y)
  }))
}
