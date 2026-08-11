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
const FILE_HINT_ID = 'file-hint'
const FILE_ERROR_ID = 'file-error'

function getExt(filename) {
  const parts = (filename || '').split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export function initSamplingPlanUpload() {
  const uploadForm = document.querySelector('[data-testid="upload-form"]')
  const fileInput = document.querySelector('[data-testid="file-input"]')
  const documentTypeSelect = document.querySelector(
    '[data-testid="document-type-input"]'
  )
  if (!fileInput || !uploadForm) return

  const errorTooLarge = uploadForm.dataset.errorTooLarge
  const errorInvalidType = uploadForm.dataset.errorInvalidType
  const errorNoDocumentType = uploadForm.dataset.errorNoDocumentType

  const formGroup = fileInput.closest('.govuk-form-group')
  const documentTypeFormGroup =
    documentTypeSelect && documentTypeSelect.closest('.govuk-form-group')

  function showDocumentTypeError() {
    if (!documentTypeSelect) return
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
    if (!documentTypeSelect) return
    documentTypeFormGroup.classList.remove('govuk-form-group--error')
    documentTypeSelect.classList.remove('govuk-select--error')
    documentTypeSelect.removeAttribute('aria-describedby')
    const errorEl = document.getElementById('document-type-error')
    if (errorEl) errorEl.remove()
  }

  function validate(file) {
    if (!file) return null
    if (ALLOWED_EXTS.indexOf(getExt(file.name)) === -1) return errorInvalidType
    if (file.size > MAX_BYTES) return errorTooLarge
    return null
  }

  function getFileButton() {
    const wrapper = fileInput.closest('.govuk-file-upload-wrapper')
    return wrapper ? wrapper.querySelector('.govuk-file-upload-button') : null
  }

  function setFileDescribedBy(hasError) {
    const value = hasError ? FILE_HINT_ID + ' ' + FILE_ERROR_ID : FILE_HINT_ID
    fileInput.setAttribute('aria-describedby', value)
    const button = getFileButton()
    if (button) button.setAttribute('aria-describedby', value)
  }

  function showError(text) {
    formGroup.classList.add('govuk-form-group--error')
    let errorEl = document.getElementById(FILE_ERROR_ID)
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = FILE_ERROR_ID
      errorEl.className = 'govuk-error-message'
      errorEl.setAttribute('data-testid', 'file-error')
      const anchor =
        fileInput.closest('.govuk-file-upload-wrapper') || fileInput
      anchor.insertAdjacentElement('beforebegin', errorEl)
    }
    errorEl.innerHTML =
      '<span class="govuk-visually-hidden">Error:</span> ' + text
    setFileDescribedBy(true)
    fileInput.value = ''
  }

  function clearError() {
    formGroup.classList.remove('govuk-form-group--error')
    setFileDescribedBy(false)
    const errorEl = document.getElementById(FILE_ERROR_ID)
    if (errorEl) errorEl.remove()
  }

  fileInput.addEventListener('change', function () {
    const error = validate(this.files[0])
    if (error) {
      showError(error)
    } else {
      clearError()
    }
  })

  if (documentTypeSelect) {
    documentTypeSelect.addEventListener('change', function () {
      if (this.value) {
        clearDocumentTypeError()
      } else {
        showDocumentTypeError()
      }
    })
  }

  uploadForm.addEventListener('submit', function (e) {
    const fileErrorText = validate(fileInput.files[0])
    const documentTypeMissing = documentTypeSelect && !documentTypeSelect.value

    if (fileErrorText || documentTypeMissing) {
      e.preventDefault()
      if (fileErrorText) showError(fileErrorText)
      if (documentTypeMissing) showDocumentTypeError()
    }
  })
}
