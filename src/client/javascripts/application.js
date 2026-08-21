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

// Shared across the client-side validation below (Basel/OECD codes and the
// sampling-plan file upload both build their own inline GDS error markup).
const GOVUK_FORM_GROUP_SELECTOR = '.govuk-form-group'
const GOVUK_FORM_GROUP_ERROR_CLASS = 'govuk-form-group--error'
const GOVUK_ERROR_MESSAGE_CLASS = 'govuk-error-message'
const ARIA_DESCRIBEDBY = 'aria-describedby'
const ERROR_MESSAGE_PREFIX =
  '<span class="govuk-visually-hidden">Error:</span> '
const GOVUK_ERROR_SUMMARY_CLASS = 'govuk-error-summary'
const INSERT_BEFOREBEGIN = 'beforebegin'

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

// The Basel Convention / OECD code fields on the "Add overseas reprocessing
// site" wizard are server-rendered <select>s (a closed, BA-signed-off list —
// see src/server/common/data/baselOecdCodes.js) enhanced into type-ahead
// comboboxes here. Deliberately NOT sharing a helper with the #country
// enhancement above: this field needs a custom `source` (starts-with match,
// capped at 10, excluding codes already picked in sibling rows), its own
// GDS-style error handling, and Continue-button gating that #country has no
// need for — folding them into one helper risked that behaviour leaking
// onto #country.
const BASEL_INPUT_ERROR_CLASS = 'govuk-input--error'

const baselOecdCodeSelects = Array.from(
  document.querySelectorAll('[data-autocomplete="basel-oecd-code"]')
)

if (baselOecdCodeSelects.length > 0) {
  initBaselOecdCodeAutocomplete(baselOecdCodeSelects)
}

function allCodesForRow(row) {
  return Array.from(row.selectElement.options)
    .map((option) => option.value)
    .filter(Boolean)
}

function codesSelectedElsewhere(rows, row) {
  return new Set(
    rows
      .filter((other) => other !== row)
      .map((other) => other.selectElement.value)
      .filter(Boolean)
  )
}

function isCodeValid(row, rawValue) {
  const value = rawValue.trim()
  if (value === '') {
    return true
  }
  return allCodesForRow(row).some(
    (code) => code.toLowerCase() === value.toLowerCase()
  )
}

function updateBaselErrorSummary(rows, errorSummaryTitle) {
  const erroredRows = rows.filter((row) => row.hasError)
  let summary = document.querySelector('[data-testid="error-summary"]')

  if (erroredRows.length === 0) {
    summary?.remove()
    return
  }

  if (!summary) {
    summary = document.createElement('div')
    summary.className = GOVUK_ERROR_SUMMARY_CLASS
    summary.dataset.module = GOVUK_ERROR_SUMMARY_CLASS
    summary.setAttribute('role', 'alert')
    summary.dataset.testid = 'error-summary'
    summary.innerHTML =
      '<h2 class="govuk-error-summary__title"></h2>' +
      '<div class="govuk-error-summary__body">' +
      '<ul class="govuk-list govuk-error-summary__list"></ul></div>'
    summary.querySelector('.govuk-error-summary__title').textContent =
      errorSummaryTitle
    const heading = document.querySelector('[data-testid="page-heading"]')
    heading?.insertAdjacentElement(INSERT_BEFOREBEGIN, summary)
  }

  const list = summary.querySelector('.govuk-error-summary__list')
  list.innerHTML = ''
  erroredRows.forEach((row) => {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.setAttribute('href', '#' + row.originalId)
    link.textContent = row.noResultsText
    item.appendChild(link)
    list.appendChild(item)
  })
}

function showRowError(row, rows, errorSummaryTitle) {
  row.hasError = true
  row.formGroup?.classList.add(GOVUK_FORM_GROUP_ERROR_CLASS)
  row.inputElement?.classList.add(BASEL_INPUT_ERROR_CLASS)

  const errorId = row.originalId + '-client-error'
  if (row.inputElement && !document.getElementById(errorId)) {
    const errorEl = document.createElement('p')
    errorEl.id = errorId
    errorEl.className = GOVUK_ERROR_MESSAGE_CLASS
    errorEl.innerHTML = ERROR_MESSAGE_PREFIX + row.noResultsText
    row.inputElement.insertAdjacentElement(INSERT_BEFOREBEGIN, errorEl)
  }
  row.inputElement?.setAttribute(ARIA_DESCRIBEDBY, errorId)
  updateBaselErrorSummary(rows, errorSummaryTitle)
}

function clearRowError(row, rows, errorSummaryTitle) {
  if (!row.hasError) {
    return
  }
  row.hasError = false
  row.formGroup?.classList.remove(GOVUK_FORM_GROUP_ERROR_CLASS)
  row.inputElement?.classList.remove(BASEL_INPUT_ERROR_CLASS)
  document.getElementById(row.originalId + '-client-error')?.remove()
  row.inputElement?.removeAttribute(ARIA_DESCRIBEDBY)
  updateBaselErrorSummary(rows, errorSummaryTitle)
}

function updateContinueButton(rows, continueButton) {
  if (!continueButton) {
    return
  }
  const allValid = rows.every(
    (row) => !row.hasError && isCodeValid(row, row.currentValue)
  )
  continueButton.disabled = !allValid
  if (allValid) {
    continueButton.removeAttribute('aria-disabled')
  } else {
    continueButton.setAttribute('aria-disabled', 'true')
  }
}

function recomputeRow(row, rawValue, rows, continueButton, errorSummaryTitle) {
  row.currentValue = rawValue
  if (isCodeValid(row, rawValue)) {
    clearRowError(row, rows, errorSummaryTitle)
  } else {
    showRowError(row, rows, errorSummaryTitle)
  }
  updateContinueButton(rows, continueButton)
}

// Starts-with match capped at 10, excluding codes already picked in
// sibling rows (AC02/AC03/AC04).
function buildBaselSourceHandler(row, rows) {
  return (query, populateResults) => {
    const excluded = codesSelectedElsewhere(rows, row)
    const available = allCodesForRow(row).filter((code) => !excluded.has(code))

    if (!query) {
      populateResults(available.slice(0, 10))
      return
    }

    const lowerQuery = query.toLowerCase()
    populateResults(
      available.filter((code) => code.toLowerCase().startsWith(lowerQuery))
    )
  }
}

// Preact updates the visible input's value directly when a suggestion is
// confirmed (click, enter, or blur-with-a-highlighted-option) — that
// doesn't dispatch a native `input` event, so the per-keystroke listener
// wouldn't otherwise see it. Hooking onConfirm covers that path too.
//
// On confirmOnBlur with nothing highlighted, the library calls
// onConfirm(undefined) — fall back to the input's current DOM value
// (accurate here: real keystrokes already wrote it, and it's what the
// per-keystroke listener was already validating against).
function buildBaselConfirmHandler(
  row,
  rows,
  continueButton,
  errorSummaryTitle
) {
  return (value) => {
    const { selectElement } = row
    const resolvedValue = (value || row.inputElement?.value || '').trim()
    const lowerResolvedValue = resolvedValue.toLowerCase()
    const requestedOption = Array.from(selectElement.options).find(
      (option) =>
        (option.textContent || option.innerText).toLowerCase() ===
        lowerResolvedValue
    )
    if (requestedOption) {
      requestedOption.selected = true
    } else {
      selectElement.value = ''
    }
    recomputeRow(row, resolvedValue, rows, continueButton, errorSummaryTitle)
  }
}

// accessible-autocomplete replaces the original <select> with a new
// enhanced <input>; the data-testid has to be moved across by hand so
// existing locators (server-rendered and e2e) keep resolving to whichever
// element is now visible.
function preserveDataTestId(selectElement, originalId) {
  const testId = selectElement.dataset.testid
  if (!testId) {
    return
  }
  const enhancedInput = document.getElementById(originalId)
  if (enhancedInput) {
    delete selectElement.dataset.testid
    enhancedInput.dataset.testid = testId
  }
}

function wireBaselOecdRow(row, rows, continueButton, errorSummaryTitle) {
  const { selectElement, originalId, noResultsText } = row

  accessibleAutocomplete.enhanceSelectElement({
    selectElement,
    // NOTE: despite the name, this does not mean "show all codes" — that
    // would defeat the point of capping the empty-query case. It's what
    // makes the library call `source('', cb)` on click/focus of an empty
    // field at all (see handleInputClick/handleInputChange in
    // accessible-autocomplete's autocomplete.js); with it left false (as
    // originally planned), the library never asks for suggestions until
    // the user types a character, and AC03's "focus an empty field, see
    // the first 10 codes" never fires. The actual cap to 10 results is
    // still enforced by our own `source` below, regardless of this flag.
    showAllValues: true,
    confirmOnBlur: true,
    defaultValue: selectElement.value,
    tNoResults: () => noResultsText,
    tStatusNoResults: () => noResultsText,
    source: buildBaselSourceHandler(row, rows),
    onConfirm: buildBaselConfirmHandler(
      row,
      rows,
      continueButton,
      errorSummaryTitle
    )
  })

  preserveDataTestId(selectElement, originalId)

  row.inputElement = document.getElementById(originalId)
  row.inputElement?.addEventListener('input', (event) => {
    recomputeRow(
      row,
      event.target.value,
      rows,
      continueButton,
      errorSummaryTitle
    )
  })
}

function initBaselOecdCodeAutocomplete(selectElements) {
  const continueButton = document.querySelector(
    '[data-testid="continue-button"]'
  )
  const form = document.querySelector('[data-testid="basel-codes-form"]')
  const errorSummaryTitle =
    form?.dataset.errorSummaryTitle || 'There is a problem'

  const rows = selectElements.map((selectElement) => ({
    selectElement,
    originalId: selectElement.id,
    noResultsText: selectElement.dataset.noResultsText || 'No matches found',
    formGroup: selectElement.closest(GOVUK_FORM_GROUP_SELECTOR),
    inputElement: null,
    // Seeded from the server-rendered form-group's error state so a 400
    // re-render for a server-only rule (atLeastOneCodeRequired,
    // duplicateCode — neither of which isCodeValid can see, since it only
    // checks per-row membership) still gates Continue and can later be
    // cleared by clearRowError once the row is fixed.
    hasError: selectElement.dataset.hasError === 'true',
    // The value this row was last known to hold — from the server-rendered
    // <select> on load, then kept in step by the input/onConfirm handlers
    // below. Used for Continue-button gating instead of re-reading the DOM
    // on every check, since onConfirm can fire before Preact has flushed
    // the confirmed value onto the visible input's DOM node.
    currentValue: selectElement.value
  }))

  rows.forEach((row) =>
    wireBaselOecdRow(row, rows, continueButton, errorSummaryTitle)
  )

  updateContinueButton(rows, continueButton)
}

// The sampling-plan-upload page's client-side validation lives here rather
// than as an inline <script> in its .njk, because the app's CSP has no
// 'unsafe-inline'/nonce for script-src — only 'self' and one hash pinned to
// a fixed GOV.UK Frontend snippet — so any inline <script> on that page is
// silently blocked by the browser. Guarded on the page's own upload form so
// this is a no-op everywhere else; upload-bes-evidence also renders a
// [data-testid="upload-form"] but has no document-type select, so checking
// for both together is what's specific to this page.
const samplingPlanUploadForm = document.querySelector(
  '[data-testid="upload-form"]'
)
const samplingPlanFileInput = samplingPlanUploadForm?.querySelector(
  '[data-testid="file-input"]'
)
const samplingPlanDocumentTypeSelect = samplingPlanUploadForm?.querySelector(
  '[data-testid="document-type-input"]'
)

if (
  samplingPlanUploadForm &&
  samplingPlanFileInput &&
  samplingPlanDocumentTypeSelect
) {
  initSamplingPlanUpload(
    samplingPlanUploadForm,
    samplingPlanFileInput,
    samplingPlanDocumentTypeSelect
  )
}

function initSamplingPlanUpload(
  uploadForm,
  initialFileInput,
  documentTypeSelect
) {
  const MAX_BYTES = 20 * 1024 * 1024
  const ALLOWED_EXTS = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'csv',
    'png',
    'tif',
    'jpg',
    'msg'
  ]
  const errorTooLarge = uploadForm.dataset.errorTooLarge
  const errorInvalidType = uploadForm.dataset.errorInvalidType
  const errorNoDocumentType = uploadForm.dataset.errorNoDocumentType
  const errorNoFile = uploadForm.dataset.errorNoFile

  // Set on a genuine 'change' event on the file input; reset on every
  // pageshow (see below). Gating submission on this, rather than on
  // fileInput.files directly, matters because on a back/forward navigation
  // the browser can silently reassert a previously chosen file into the
  // input after this script has already run once. Neither
  // Cache-Control: no-store nor clearing fileInput.value survives that.
  let userSelectedFile = false
  let fileInput = initialFileInput
  const formGroup = fileInput.closest(GOVUK_FORM_GROUP_SELECTOR)
  const documentTypeFormGroup = documentTypeSelect.closest(
    GOVUK_FORM_GROUP_SELECTOR
  )

  function showDocumentTypeError() {
    documentTypeFormGroup.classList.add(GOVUK_FORM_GROUP_ERROR_CLASS)
    documentTypeSelect.classList.add('govuk-select--error')
    let errorEl = document.getElementById('document-type-error')
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = 'document-type-error'
      errorEl.className = GOVUK_ERROR_MESSAGE_CLASS
      errorEl.setAttribute('data-testid', 'document-type-error')
      documentTypeSelect.insertAdjacentElement(INSERT_BEFOREBEGIN, errorEl)
    }
    errorEl.innerHTML = ERROR_MESSAGE_PREFIX + errorNoDocumentType
    documentTypeSelect.setAttribute(ARIA_DESCRIBEDBY, 'document-type-error')
  }

  function clearDocumentTypeError() {
    documentTypeFormGroup.classList.remove(GOVUK_FORM_GROUP_ERROR_CLASS)
    documentTypeSelect.classList.remove('govuk-select--error')
    documentTypeSelect.removeAttribute(ARIA_DESCRIBEDBY)
    const errorEl = document.getElementById('document-type-error')
    if (errorEl) errorEl.remove()
  }

  function getExt(filename) {
    const parts = (filename || '').split('.')
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  }

  function validate(file) {
    if (!file) return null
    if (!ALLOWED_EXTS.includes(getExt(file.name))) return errorInvalidType
    if (file.size > MAX_BYTES) return errorTooLarge
    return null
  }

  function showError(text) {
    formGroup.classList.add(GOVUK_FORM_GROUP_ERROR_CLASS)
    fileInput.classList.add('govuk-file-upload--error')
    let errorEl = document.getElementById('file-error')
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = 'file-error'
      errorEl.className = GOVUK_ERROR_MESSAGE_CLASS
      errorEl.setAttribute('data-testid', 'file-error')
      fileInput.insertAdjacentElement(INSERT_BEFOREBEGIN, errorEl)
    }
    errorEl.innerHTML = ERROR_MESSAGE_PREFIX + text
    fileInput.setAttribute(ARIA_DESCRIBEDBY, 'file-error')
    fileInput.value = ''
  }

  function clearError() {
    formGroup.classList.remove(GOVUK_FORM_GROUP_ERROR_CLASS)
    fileInput.classList.remove('govuk-file-upload--error')
    fileInput.removeAttribute(ARIA_DESCRIBEDBY)
    const errorEl = document.getElementById('file-error')
    if (errorEl) errorEl.remove()
  }

  function attachFileInputChangeListener(input) {
    input.addEventListener('change', function () {
      userSelectedFile = true
      const error = validate(input.files[0])
      if (error) {
        showError(error)
      } else {
        clearError()
      }
    })
  }

  attachFileInputChangeListener(fileInput)

  documentTypeSelect.addEventListener('change', function () {
    if (this.value) {
      clearDocumentTypeError()
    } else {
      showDocumentTypeError()
    }
  })

  uploadForm.addEventListener('submit', function (e) {
    const fileErrorText = !userSelectedFile
      ? errorNoFile
      : validate(fileInput.files[0])
    const documentTypeMissing = !documentTypeSelect.value

    if (fileErrorText || documentTypeMissing) {
      e.preventDefault()
      if (fileErrorText) {
        showError(fileErrorText)
      }
      if (documentTypeMissing) {
        showDocumentTypeError()
      }
    }
  })

  // RA-436: a browser back/forward navigation can restore this page whole
  // from bfcache with a file still sitting in the input. Left alone,
  // clicking "Upload file" resubmits that same file and adds it to the
  // list again as a duplicate. Cache-Control: no-store doesn't prevent
  // this — Chrome still allows no-store pages into bfcache. Replace the
  // input element itself with a fresh clone: the browser only has
  // restorable state for the specific element instance that existed in
  // the page it navigated away from, so a freshly created element has
  // nothing to restore onto.
  function swapFileInput() {
    const freshInput = fileInput.cloneNode(true)
    freshInput.value = ''
    fileInput.replaceWith(freshInput)
    fileInput = freshInput
    attachFileInputChangeListener(fileInput)
  }

  // Only a genuine bfcache restore (event.persisted) reasserts a
  // previously selected file into the input — a normal load/reload never
  // does. Gating on persisted is what keeps this from firing on the
  // server's 400 re-render of this same view (noFile/invalidType/
  // fileTooLarge/uploadError), which would otherwise wipe the
  // server-rendered error the moment the page loads.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return
    userSelectedFile = false
    swapFileInput()
    clearError()
  })
}
