import {
  createAll,
  Button,
  CharacterCount,
  Checkboxes,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

createAll(Button)
createAll(CharacterCount)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)

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
