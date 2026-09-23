import { describe, test, expect } from 'vitest'
import {
  normaliseFilenameKey,
  collectApplicationFilenames,
  isDuplicateFilename
} from './duplicateFilename.js'

describe('#normaliseFilenameKey', () => {
  test('strips the extension', () => {
    expect(normaliseFilenameKey('Evidence Rafa.pdf')).toBe('EVIDENCE RAFA')
  })

  // AC02: same base name, different extension — must normalise to the same key.
  test('ignores extension so different formats collide', () => {
    expect(normaliseFilenameKey('Evidence Rafa.pdf')).toBe(
      normaliseFilenameKey('Evidence Rafa.docx')
    )
  })

  test('is case-insensitive', () => {
    expect(normaliseFilenameKey('Evidence Rafa.PDF')).toBe(
      normaliseFilenameKey('evidence rafa.pdf')
    )
  })

  test('treats a leading dot as part of the name, not an extension', () => {
    expect(normaliseFilenameKey('.gitignore')).toBe('.GITIGNORE')
  })

  test('handles a filename with no extension', () => {
    expect(normaliseFilenameKey('README')).toBe('README')
  })

  test.each([undefined, null, '', '   ', 42, {}])(
    'returns an empty string for %s',
    (value) => {
      expect(normaliseFilenameKey(value)).toBe('')
    }
  )
})

describe('#collectApplicationFilenames', () => {
  test('returns an empty array for an application with no files anywhere', () => {
    expect(collectApplicationFilenames({})).toEqual([])
    expect(collectApplicationFilenames(null)).toEqual([])
  })

  test('collects sampling plan filenames', () => {
    const application = {
      samplingPlan: {
        files: [{ filename: 'plan.pdf' }, { filename: 'evidence.docx' }]
      }
    }
    expect(collectApplicationFilenames(application)).toEqual([
      'plan.pdf',
      'evidence.docx'
    ])
  })

  test('collects BES evidence filenames across every overseas site', () => {
    const application = {
      overseasSites: {
        sites: [
          {
            siteId: 1,
            besEvidence: { besEvidenceUploads: [{ filename: 'site1.pdf' }] }
          },
          {
            siteId: 2,
            besEvidence: { besEvidenceUploads: [{ filename: 'site2.pdf' }] }
          },
          // A site with no BES evidence yet must not blow up the walk.
          { siteId: 3 }
        ]
      }
    }
    expect(collectApplicationFilenames(application)).toEqual([
      'site1.pdf',
      'site2.pdf'
    ])
  })

  test('combines sampling plan and BES evidence filenames', () => {
    const application = {
      samplingPlan: { files: [{ filename: 'plan.pdf' }] },
      overseasSites: {
        sites: [
          {
            siteId: 1,
            besEvidence: { besEvidenceUploads: [{ filename: 'evidence.pdf' }] }
          }
        ]
      }
    }
    expect(collectApplicationFilenames(application)).toEqual([
      'plan.pdf',
      'evidence.pdf'
    ])
  })
})

describe('#isDuplicateFilename', () => {
  test('returns false when no files exist', () => {
    expect(isDuplicateFilename('new.pdf', {})).toBe(false)
  })

  test('returns false for a new filename', () => {
    const application = { samplingPlan: { files: [{ filename: 'plan.pdf' }] } }
    expect(isDuplicateFilename('evidence.pdf', application)).toBe(false)
  })

  test('returns true for an exact match within the same section', () => {
    const application = { samplingPlan: { files: [{ filename: 'plan.pdf' }] } }
    expect(isDuplicateFilename('plan.pdf', application)).toBe(true)
  })

  // AC02
  test('returns true for the same base name with a different extension', () => {
    const application = {
      samplingPlan: { files: [{ filename: 'Evidence Rafa.pdf' }] }
    }
    expect(isDuplicateFilename('Evidence Rafa.docx', application)).toBe(true)
  })

  // "within a single application submission" — a sampling-plan filename
  // collides with one already uploaded as BES evidence on an overseas site.
  test('returns true across sampling plan and BES evidence on a different site', () => {
    const application = {
      samplingPlan: { files: [{ filename: 'plan.pdf' }] },
      overseasSites: {
        sites: [
          {
            siteId: 1,
            besEvidence: {
              besEvidenceUploads: [{ filename: 'Evidence Rafa.pdf' }]
            }
          }
        ]
      }
    }
    expect(isDuplicateFilename('plan.pdf', application)).toBe(true)
    expect(isDuplicateFilename('Evidence Rafa.docx', application)).toBe(true)
  })

  test('returns true across two different overseas sites', () => {
    const application = {
      overseasSites: {
        sites: [
          {
            siteId: 1,
            besEvidence: {
              besEvidenceUploads: [{ filename: 'Evidence Rafa.pdf' }]
            }
          },
          {
            siteId: 2,
            besEvidence: { besEvidenceUploads: [{ filename: 'Other.docx' }] }
          }
        ]
      }
    }
    expect(isDuplicateFilename('evidence rafa.PDF', application)).toBe(true)
  })

  test.each([undefined, null, '', '   '])(
    'returns false for a blank candidate filename (%s)',
    (filename) => {
      const application = {
        samplingPlan: { files: [{ filename: 'plan.pdf' }] }
      }
      expect(isDuplicateFilename(filename, application)).toBe(false)
    }
  )

  test('tolerates an application with no overseas sites', () => {
    const application = {
      samplingPlan: { files: [{ filename: 'plan.pdf' }] },
      overseasSites: null
    }
    expect(isDuplicateFilename('other.pdf', application)).toBe(false)
    expect(isDuplicateFilename('plan.pdf', application)).toBe(true)
  })
})
