import { describe, test, expect } from 'vitest'
import { materialDisplayName } from './materialDisplayName.js'

const t = (key) => {
  const map = {
    'pages.materialSelection.materials.Plastic': 'Plastic',
    'pages.materialSelection.glassRemelt': 'Glass (re-melt)',
    'pages.materialSelection.glassOther': 'Glass (other)'
  }
  return map[key] ?? key
}

describe('materialDisplayName', () => {
  test('returns an empty string when materialType is unset', () => {
    expect(materialDisplayName({}, t)).toBe('')
  })

  test('returns the translated material name for a non-Glass material', () => {
    expect(materialDisplayName({ materialType: 'Plastic' }, t)).toBe('Plastic')
  })

  test('resolves Glass with the glass_re_melt process to its own copy', () => {
    expect(
      materialDisplayName(
        { materialType: 'Glass', glassRecyclingProcess: ['glass_re_melt'] },
        t
      )
    ).toBe('Glass (re-melt)')
  })

  test('resolves Glass with the glass_other process to its own copy', () => {
    expect(
      materialDisplayName(
        { materialType: 'Glass', glassRecyclingProcess: ['glass_other'] },
        t
      )
    ).toBe('Glass (other)')
  })

  test('falls back to the generic material key for Glass with an empty glassRecyclingProcess array', () => {
    expect(
      materialDisplayName(
        { materialType: 'Glass', glassRecyclingProcess: [] },
        t
      )
    ).toBe('pages.materialSelection.materials.Glass')
  })

  test('falls back to the generic material key for Glass with no recognised process', () => {
    expect(materialDisplayName({ materialType: 'Glass' }, t)).toBe(
      'pages.materialSelection.materials.Glass'
    )
  })

  test('uses the first element defensively if glassRecyclingProcess ever has more than one', () => {
    expect(
      materialDisplayName(
        {
          materialType: 'Glass',
          glassRecyclingProcess: ['glass_other', 'glass_re_melt']
        },
        t
      )
    ).toBe('Glass (other)')
  })
})
