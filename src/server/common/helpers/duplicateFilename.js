// RA-571: no two files anywhere on an application submission may share a filename, so a
// regulator can unambiguously reference one by name. "Anywhere" means the sampling plan and
// every overseas site's BES evidence together, not just the section being uploaded to.
// Uniqueness is judged on the filename's base name only (AC02): "Evidence Rafa.pdf" and
// "Evidence Rafa.docx" collide despite the different extension, and the comparison is
// case-insensitive so "A.pdf" and "a.PDF" collide too.
//
// This is the early, friendly copy of the rule (AC04) — DuplicateFilenameGuard in
// epr-register-enrol-backend is the authoritative check the two upload endpoints enforce
// server-side, since a client-only check can't stop a second concurrent request.

/**
 * The base name (no extension), trimmed and upper-cased, used to compare two filenames.
 * Returns '' for a non-string/blank filename, which never matches anything.
 */
export function normaliseFilenameKey(filename) {
  if (typeof filename !== 'string') {
    return ''
  }
  const trimmed = filename.trim()
  if (!trimmed) {
    return ''
  }
  const dotIndex = trimmed.lastIndexOf('.')
  // A dot at index 0 (".gitignore"-style) has no "extension" to strip.
  const stem = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed
  return stem.trim().toUpperCase()
}

/**
 * Every filename currently attached to `application` — sampling plan files plus every
 * overseas site's BES evidence uploads.
 */
export function collectApplicationFilenames(application) {
  const samplingPlanFilenames = (application?.samplingPlan?.files ?? []).map(
    (f) => f?.filename
  )
  const besEvidenceFilenames = (
    application?.overseasSites?.sites ?? []
  ).flatMap((site) =>
    (site?.besEvidence?.besEvidenceUploads ?? []).map((f) => f?.filename)
  )
  return [...samplingPlanFilenames, ...besEvidenceFilenames]
}

export function isDuplicateFilename(filename, application) {
  const key = normaliseFilenameKey(filename)
  if (!key) {
    return false
  }
  return collectApplicationFilenames(application).some(
    (existing) => normaliseFilenameKey(existing) === key
  )
}
