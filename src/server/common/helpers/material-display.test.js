import { buildMaterialDisplay } from './material-display.js'

const t = (key) => key.split('.').pop()

describe('#buildMaterialDisplay', () => {
  test('returns material name with recycling process suffix for glass + remelt', () => {
    expect(buildMaterialDisplay('Glass', 'glass_re_melt', t)).toBe(
      'Glass - glass_re_melt'
    )
  })

  test('returns material name with recycling process suffix for glass + other', () => {
    expect(buildMaterialDisplay('Glass', 'glass_other', t)).toBe(
      'Glass - glass_other'
    )
  })

  test('returns plain material name for glass with no recycling process set', () => {
    expect(buildMaterialDisplay('Glass', null, t)).toBe('Glass')
  })

  test('returns plain material name for glass with undefined recycling process', () => {
    expect(buildMaterialDisplay('Glass', undefined, t)).toBe('Glass')
  })

  test('ignores recycling process for non-glass materials', () => {
    expect(buildMaterialDisplay('Steel', 'glass_re_melt', t)).toBe('Steel')
  })

  test('is case-insensitive when matching Glass', () => {
    expect(buildMaterialDisplay('glass', 'glass_other', t)).toBe(
      'glass - glass_other'
    )
  })
})
