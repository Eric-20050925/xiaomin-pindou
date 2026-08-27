import { describe, expect, it } from 'vitest'
import { COLOR_STYLES, COLOR_STYLE_LABELS } from './colorStyles'

describe('color style catalog', () => {
  it('contains eight unique, fully labeled styles', () => {
    expect(COLOR_STYLES).toHaveLength(8)
    expect(new Set(COLOR_STYLES.map((style) => style.id)).size).toBe(8)
    for (const style of COLOR_STYLES) {
      expect(COLOR_STYLE_LABELS[style.id]).toBe(style.label)
      expect(style.description.length).toBeGreaterThan(4)
    }
  })
})
