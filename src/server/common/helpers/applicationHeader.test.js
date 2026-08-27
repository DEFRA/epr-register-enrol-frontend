import { describe, test, expect } from 'vitest'
import {
  buildApplicationHeaderViewModel,
  composeApplicationCaption
} from './applicationHeader.js'

const t = (key) => {
  const map = {
    'pages.materialSelection.materials.Plastic': 'Plastic',
    'pages.taskList.siteNotSet': 'Not set'
  }
  return map[key] ?? key
}

describe('buildApplicationHeaderViewModel', () => {
  test('builds operator name, material type, site name and year for a non-exporter application', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: false,
          siteAddress: '1 Recycling Way, Leeds',
          year: 2027
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: '1 Recycling Way, Leeds',
      year: 2027,
      captionText: 'Delta Green Ltd (2027, Plastic, 1 Recycling Way, Leeds)',
      showFullHeader: false
    })
  })

  test('uses the UK registered address instead of the site address for exporters', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: true,
          siteAddress: 'should be ignored',
          companyRegisteredAddress: '4 Glassworks Court, Bristol, BS1 4AA',
          year: 2027
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: '4 Glassworks Court, Bristol, BS1 4AA',
      year: 2027,
      captionText:
        'Delta Green Ltd (2027, Plastic, 4 Glassworks Court, Bristol, BS1 4AA)',
      showFullHeader: false
    })
  })

  test('falls back to the siteNotSet copy for exporters when companyRegisteredAddress is missing', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: true,
          siteAddress: 'should be ignored',
          companyRegisteredAddress: null,
          year: 2027
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: 'Not set',
      year: 2027,
      captionText: 'Delta Green Ltd (2027, Plastic)',
      showFullHeader: false
    })
  })

  test('falls back to the siteNotSet copy when siteAddress is missing', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: false,
          siteAddress: null,
          year: 2027
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: 'Not set',
      year: 2027,
      captionText: 'Delta Green Ltd (2027, Plastic)',
      showFullHeader: false
    })
  })
})

describe('composeApplicationCaption', () => {
  test('returns formatted caption with all parameters, comma-joined', () => {
    expect(
      composeApplicationCaption({
        operatorName: 'Acme Ltd',
        year: 2025,
        materialType: 'Plastic',
        siteName: 'Kings Warehouse'
      })
    ).toBe('Acme Ltd (2025, Plastic, Kings Warehouse)')
  })

  // RA102-mgwh: a multi-part site address (already comma-separated) must
  // not be preceded by "and" -- every part is joined with ", " throughout.
  test('comma-joins a multi-part site address without an "and"', () => {
    expect(
      composeApplicationCaption({
        operatorName: 'NEWDEV RECYCLING LIMITED',
        year: 2027,
        materialType: 'Plastic',
        siteName: 'UNIT 5, Bolton, BL4 7AQ'
      })
    ).toBe('NEWDEV RECYCLING LIMITED (2027, Plastic, UNIT 5, Bolton, BL4 7AQ)')
  })

  test('omits siteName when null', () => {
    expect(
      composeApplicationCaption({
        operatorName: 'Acme Ltd',
        year: 2025,
        materialType: 'Plastic',
        siteName: null
      })
    ).toBe('Acme Ltd (2025, Plastic)')
  })

  test('omits siteName when empty string', () => {
    expect(
      composeApplicationCaption({
        operatorName: 'Acme Ltd',
        year: 2025,
        materialType: 'Plastic',
        siteName: ''
      })
    ).toBe('Acme Ltd (2025, Plastic)')
  })

  test('omits siteName when undefined', () => {
    expect(
      composeApplicationCaption({
        operatorName: 'Acme Ltd',
        year: 2025,
        materialType: 'Plastic',
        siteName: undefined
      })
    ).toBe('Acme Ltd (2025, Plastic)')
  })
})
