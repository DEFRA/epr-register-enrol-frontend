import {
  createAll,
  Button,
  CharacterCount,
  Checkboxes,
  ErrorSummary,
  FileUpload,
  Radios,
  SkipLink
} from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'
import { initSamplingPlanUpload } from './sampling-plan-upload.js'

createAll(Button)
createAll(CharacterCount)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Radios)
createAll(SkipLink)

initSamplingPlanUpload()

const countrySelect = document.getElementById('country')
if (countrySelect) {
  const testId = countrySelect.getAttribute('data-testid')
  accessibleAutocomplete.enhanceSelectElement({
    selectElement: countrySelect,
    showAllValues: true
  })
  if (testId) {
    countrySelect.removeAttribute('data-testid')
    document.getElementById('country')?.setAttribute('data-testid', testId)
  }
}
