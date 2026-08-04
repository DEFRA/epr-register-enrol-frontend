import { describe, test, expect } from 'vitest'
import { buildApplicationHeaderViewModel } from './applicationHeader.js'

const t = (key) => {
  const map = {
    'pages.materialSelection.materials.Plastic': 'Plastic',
    'pages.operatorAccreditation.exporterLabel': 'Exporter',
    'pages.taskList.siteNotSet': 'Not set'
  }
  return map[key] ?? key
}

describe('buildApplicationHeaderViewModel', () => {
  test('builds operator name, material type and site name for a non-exporter application', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: false,
          siteAddress: '1 Recycling Way, Leeds'
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: '1 Recycling Way, Leeds'
    })
  })

  test('uses the exporter label instead of a site address for exporters', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: true,
          siteAddress: 'should be ignored'
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: 'Exporter'
    })
  })

  test('falls back to the siteNotSet copy when siteAddress is missing', () => {
    expect(
      buildApplicationHeaderViewModel(
        {
          organisationName: 'Delta Green Ltd',
          materialType: 'Plastic',
          isExporter: false,
          siteAddress: null
        },
        t
      )
    ).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: 'Not set'
    })
  })
})
