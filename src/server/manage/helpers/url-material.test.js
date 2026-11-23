import { describe, expect, it } from 'vitest'

import { matchesUrlMaterial, parseUrlMaterial } from './url-material.js'

describe('parseUrlMaterial', () => {
  it.each(['Plastic', 'Glass'])(
    'reads %s with no glass recycling process',
    (value) => {
      expect(parseUrlMaterial(value)).toEqual({
        materialType: value,
        glassRecyclingProcess: null
      })
    }
  )

  it.each(['glass_re_melt', 'glass_other'])(
    'reads %s as Glass with that recycling process',
    (value) => {
      expect(parseUrlMaterial(value)).toEqual({
        materialType: 'Glass',
        glassRecyclingProcess: value
      })
    }
  )
})

describe('matchesUrlMaterial', () => {
  const plastic = { materialType: 'Plastic', glassRecyclingProcess: null }
  const reMelt = {
    materialType: 'Glass',
    glassRecyclingProcess: 'glass_re_melt'
  }
  const other = {
    materialType: 'Glass',
    glassRecyclingProcess: ['glass_other']
  }

  it('matches the material whatever the record’s case', () => {
    expect(matchesUrlMaterial(plastic, parseUrlMaterial('Plastic'))).toBe(true)
    expect(
      matchesUrlMaterial(
        { materialType: 'plastic' },
        parseUrlMaterial('Plastic')
      )
    ).toBe(true)
  })

  it('refuses another material', () => {
    expect(matchesUrlMaterial(plastic, parseUrlMaterial('Paper'))).toBe(false)
    expect(matchesUrlMaterial(reMelt, parseUrlMaterial('Plastic'))).toBe(false)
    expect(matchesUrlMaterial(plastic, parseUrlMaterial('glass_re_melt'))).toBe(
      false
    )
  })

  it('matches a glass recycling process held as a string or an array', () => {
    expect(matchesUrlMaterial(reMelt, parseUrlMaterial('glass_re_melt'))).toBe(
      true
    )
    expect(matchesUrlMaterial(other, parseUrlMaterial('glass_other'))).toBe(
      true
    )
  })

  it('refuses the other glass recycling process', () => {
    expect(matchesUrlMaterial(reMelt, parseUrlMaterial('glass_other'))).toBe(
      false
    )
    expect(matchesUrlMaterial(other, parseUrlMaterial('glass_re_melt'))).toBe(
      false
    )
  })

  it('refuses a glass recycling process when the record has none', () => {
    const unspecified = { materialType: 'Glass', glassRecyclingProcess: [] }
    expect(
      matchesUrlMaterial(unspecified, parseUrlMaterial('glass_re_melt'))
    ).toBe(false)
  })

  it('matches plain Glass whatever the recycling process', () => {
    const glass = parseUrlMaterial('Glass')
    expect(matchesUrlMaterial(reMelt, glass)).toBe(true)
    expect(matchesUrlMaterial(other, glass)).toBe(true)
  })

  it('refuses a record with no material', () => {
    expect(matchesUrlMaterial({}, parseUrlMaterial('Plastic'))).toBe(false)
  })
})
