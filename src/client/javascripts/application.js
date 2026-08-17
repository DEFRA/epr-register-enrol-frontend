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
