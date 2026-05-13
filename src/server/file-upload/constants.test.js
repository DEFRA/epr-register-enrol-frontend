import { describe, test, expect } from 'vitest'
import { MATERIALS, getYearOptions, FILE_UPLOAD_SESSION_KEY } from './constants.js'

describe('#FILE_UPLOAD_SESSION_KEY', () => {
  test('is a non-empty string', () => {
    expect(typeof FILE_UPLOAD_SESSION_KEY).toBe('string')
    expect(FILE_UPLOAD_SESSION_KEY.length).toBeGreaterThan(0)
  })
})

describe('#MATERIALS', () => {
  test('contains all seven materials', () => {
    expect(MATERIALS).toHaveLength(7)
  })

  test('each material has value and text', () => {
    MATERIALS.forEach((m) => {
      expect(m).toHaveProperty('value')
      expect(m).toHaveProperty('text')
      expect(typeof m.value).toBe('string')
      expect(typeof m.text).toBe('string')
    })
  })

  test('includes Steel', () => {
    expect(MATERIALS.some((m) => m.value === 'Steel')).toBe(true)
  })

  test('includes Plastic', () => {
    expect(MATERIALS.some((m) => m.value === 'Plastic')).toBe(true)
  })
})

describe('#getYearOptions', () => {
  test('returns exactly three year options', () => {
    const options = getYearOptions()
    expect(options).toHaveLength(3)
  })

  test('includes the current year', () => {
    const currentYear = String(new Date().getFullYear())
    const options = getYearOptions()
    expect(options.some((o) => o.value === currentYear)).toBe(true)
  })

  test('includes two years prior to current year', () => {
    const currentYear = new Date().getFullYear()
    const options = getYearOptions()
    const values = options.map((o) => Number(o.value))
    expect(values).toContain(currentYear - 2)
    expect(values).toContain(currentYear - 1)
    expect(values).toContain(currentYear)
  })

  test('years are in ascending order', () => {
    const options = getYearOptions()
    const values = options.map((o) => Number(o.value))
    expect(values[0]).toBeLessThan(values[1])
    expect(values[1]).toBeLessThan(values[2])
  })

  test('each option has matching value and text strings', () => {
    const options = getYearOptions()
    options.forEach((o) => {
      expect(o.value).toBe(o.text)
    })
  })
})
