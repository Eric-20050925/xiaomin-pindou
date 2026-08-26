import { describe, expect, it } from 'vitest'
import { palette, paletteCatalog, paletteGroups } from './palette'

describe('MARD 221 reference palette', () => {
  it('contains 221 unique color codes', () => {
    expect(palette).toHaveLength(221)
    expect(new Set(palette.map((color) => color.code)).size).toBe(221)
  })

  it('contains all documented color groups', () => {
    expect(paletteGroups).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'])
  })

  it('has valid RGB values and precomputed Lab values', () => {
    palette.forEach((color) => {
      expect(color.rgb).toHaveLength(3)
      expect(color.rgb.every((channel) => channel >= 0 && channel <= 255)).toBe(true)
      expect(color.lab.every(Number.isFinite)).toBe(true)
    })
  })
})

describe('palette catalog', () => {
  it('contains the supported brand palettes with unique ids', () => {
    expect(paletteCatalog).toHaveLength(9)
    expect(new Set(paletteCatalog.map((item) => item.id)).size).toBe(9)
  })

  it('only exposes usable, uniquely coded colors', () => {
    paletteCatalog.forEach((item) => {
      expect(item.colors.length).toBeGreaterThanOrEqual(174)
      expect(new Set(item.colors.map((color) => color.code)).size).toBe(item.colors.length)
      expect(item.colors.every((color) => !color.code.startsWith('UNKNOWN-'))).toBe(true)
    })
  })
})
