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

// The Basel Convention / OECD code fields on the "Add overseas reprocessing
// site" wizard are server-rendered <select>s (a closed, BA-signed-off list —
// see src/server/common/data/baselOecdCodes.js) enhanced into type-ahead
// comboboxes here. Deliberately NOT sharing a helper with the #country
// enhancement above: this field needs a custom `source` (starts-with match,
// capped at 10, excluding codes already picked in sibling rows), its own
// GDS-style error handling, and Continue-button gating that #country has no
// need for — folding them into one helper risked that behaviour leaking
// onto #country.
const baselOecdCodeSelects = Array.from(
  document.querySelectorAll('[data-autocomplete="basel-oecd-code"]')
)

if (baselOecdCodeSelects.length > 0) {
  initBaselOecdCodeAutocomplete(baselOecdCodeSelects)
}

function initBaselOecdCodeAutocomplete(selectElements) {
  const continueButton = document.querySelector(
    '[data-testid="continue-button"]'
  )
  const form = document.querySelector('[data-testid="basel-codes-form"]')
  const errorSummaryTitle =
    form?.getAttribute('data-error-summary-title') || 'There is a problem'

  const rows = selectElements.map((selectElement) => ({
    selectElement,
    originalId: selectElement.id,
    noResultsText:
      selectElement.getAttribute('data-no-results-text') || 'No matches found',
    formGroup: selectElement.closest('.govuk-form-group'),
    inputElement: null,
    hasError: false,
    // The value this row was last known to hold — from the server-rendered
    // <select> on load, then kept in step by the input/onConfirm handlers
    // below. Used for Continue-button gating instead of re-reading the DOM
    // on every check, since onConfirm can fire before Preact has flushed
    // the confirmed value onto the visible input's DOM node.
    currentValue: selectElement.value
  }))

  function allCodesForRow(row) {
    return Array.from(row.selectElement.options)
      .map((option) => option.value)
      .filter(Boolean)
  }

  function codesSelectedElsewhere(row) {
    return new Set(
      rows
        .filter((other) => other !== row)
        .map((other) => other.selectElement.value)
        .filter(Boolean)
    )
  }

  function isCodeValid(row, rawValue) {
    const value = rawValue.trim()
    if (value === '') return true
    return allCodesForRow(row).some(
      (code) => code.toLowerCase() === value.toLowerCase()
    )
  }

  function updateErrorSummary() {
    const erroredRows = rows.filter((row) => row.hasError)
    let summary = document.querySelector('[data-testid="error-summary"]')

    if (erroredRows.length === 0) {
      summary?.remove()
      return
    }

    if (!summary) {
      summary = document.createElement('div')
      summary.className = 'govuk-error-summary'
      summary.setAttribute('data-module', 'govuk-error-summary')
      summary.setAttribute('role', 'alert')
      summary.setAttribute('data-testid', 'error-summary')
      summary.innerHTML =
        '<h2 class="govuk-error-summary__title"></h2>' +
        '<div class="govuk-error-summary__body">' +
        '<ul class="govuk-list govuk-error-summary__list"></ul></div>'
      summary.querySelector('.govuk-error-summary__title').textContent =
        errorSummaryTitle
      const heading = document.querySelector('[data-testid="page-heading"]')
      heading?.insertAdjacentElement('beforebegin', summary)
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

  function showRowError(row) {
    row.hasError = true
    row.formGroup?.classList.add('govuk-form-group--error')
    row.inputElement?.classList.add('govuk-input--error')

    const errorId = row.originalId + '-client-error'
    if (row.inputElement && !document.getElementById(errorId)) {
      const errorEl = document.createElement('p')
      errorEl.id = errorId
      errorEl.className = 'govuk-error-message'
      errorEl.innerHTML =
        '<span class="govuk-visually-hidden">Error:</span> ' + row.noResultsText
      row.inputElement.insertAdjacentElement('beforebegin', errorEl)
    }
    row.inputElement?.setAttribute('aria-describedby', errorId)
    updateErrorSummary()
  }

  function clearRowError(row) {
    if (!row.hasError) return
    row.hasError = false
    row.formGroup?.classList.remove('govuk-form-group--error')
    row.inputElement?.classList.remove('govuk-input--error')
    document.getElementById(row.originalId + '-client-error')?.remove()
    row.inputElement?.removeAttribute('aria-describedby')
    updateErrorSummary()
  }

  function updateContinueButton() {
    if (!continueButton) return
    const allValid = rows.every((row) => isCodeValid(row, row.currentValue))
    continueButton.disabled = !allValid
    if (allValid) {
      continueButton.removeAttribute('aria-disabled')
    } else {
      continueButton.setAttribute('aria-disabled', 'true')
    }
  }

  function recomputeRow(row, rawValue) {
    row.currentValue = rawValue
    if (isCodeValid(row, rawValue)) {
      clearRowError(row)
    } else {
      showRowError(row)
    }
    updateContinueButton()
  }

  rows.forEach((row) => {
    const { selectElement, originalId, noResultsText } = row
    const testId = selectElement.getAttribute('data-testid')

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
      source(query, populateResults) {
        const excluded = codesSelectedElsewhere(row)
        const available = allCodesForRow(row).filter(
          (code) => !excluded.has(code)
        )

        if (!query) {
          populateResults(available.slice(0, 10))
          return
        }

        const lowerQuery = query.toLowerCase()
        populateResults(
          available.filter((code) => code.toLowerCase().startsWith(lowerQuery))
        )
      },
      // Preact updates the visible input's value directly when a suggestion
      // is confirmed (click, enter, or blur-with-a-highlighted-option) —
      // that doesn't dispatch a native `input` event, so the listener below
      // wouldn't otherwise see it. Hook onConfirm to cover that path too.
      //
      // On confirmOnBlur with nothing highlighted, the library calls
      // onConfirm(undefined) — fall back to the input's current DOM value
      // (accurate here: real keystrokes already wrote it, and it's what the
      // per-keystroke listener below was already validating against).
      onConfirm(value) {
        const resolvedValue = (value || row.inputElement?.value || '').trim()
        const requestedOption = Array.from(selectElement.options).find(
          (option) => (option.textContent || option.innerText) === resolvedValue
        )
        if (requestedOption) {
          requestedOption.selected = true
        } else {
          selectElement.value = ''
        }
        recomputeRow(row, resolvedValue)
      }
    })

    if (testId) {
      selectElement.removeAttribute('data-testid')
      document.getElementById(originalId)?.setAttribute('data-testid', testId)
    }

    row.inputElement = document.getElementById(originalId)
    row.inputElement?.addEventListener('input', (event) => {
      recomputeRow(row, event.target.value)
    })
  })

  updateContinueButton()
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
  const formGroup = fileInput.closest('.govuk-form-group')
  const documentTypeFormGroup = documentTypeSelect.closest('.govuk-form-group')

  function showDocumentTypeError() {
    documentTypeFormGroup.classList.add('govuk-form-group--error')
    documentTypeSelect.classList.add('govuk-select--error')
    let errorEl = document.getElementById('document-type-error')
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = 'document-type-error'
      errorEl.className = 'govuk-error-message'
      errorEl.setAttribute('data-testid', 'document-type-error')
      documentTypeSelect.insertAdjacentElement('beforebegin', errorEl)
    }
    errorEl.innerHTML =
      '<span class="govuk-visually-hidden">Error:</span> ' + errorNoDocumentType
    documentTypeSelect.setAttribute('aria-describedby', 'document-type-error')
  }

  function clearDocumentTypeError() {
    documentTypeFormGroup.classList.remove('govuk-form-group--error')
    documentTypeSelect.classList.remove('govuk-select--error')
    documentTypeSelect.removeAttribute('aria-describedby')
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
    formGroup.classList.add('govuk-form-group--error')
    fileInput.classList.add('govuk-file-upload--error')
    let errorEl = document.getElementById('file-error')
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = 'file-error'
      errorEl.className = 'govuk-error-message'
      errorEl.setAttribute('data-testid', 'file-error')
      fileInput.insertAdjacentElement('beforebegin', errorEl)
    }
    errorEl.innerHTML =
      '<span class="govuk-visually-hidden">Error:</span> ' + text
    fileInput.setAttribute('aria-describedby', 'file-error')
    fileInput.value = ''
  }

  function clearError() {
    formGroup.classList.remove('govuk-form-group--error')
    fileInput.classList.remove('govuk-file-upload--error')
    fileInput.removeAttribute('aria-describedby')
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
