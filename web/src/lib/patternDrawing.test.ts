import { describe, expect, it } from 'vitest'
import { patternLabelColor, patternLabelFontSize } from './patternDrawing'

describe('pattern label sizing', () => {
  it('keeps long color codes within small mobile cells', () => {
    expect(patternLabelFontSize(11, 'A1')).toBeCloseTo(4.4, 5)
    expect(patternLabelFontSize(11, 'C-123')).toBe(3.5)
  })

  it('caps labels in large cells', () => {
    expect(patternLabelFontSize(40, 'A1')).toBe(12)
  })

  it('chooses high-contrast text for light and dark beads', () => {
    expect(patternLabelColor('#ffffff')).toContain('12, 18, 14')
    expect(patternLabelColor('#000000')).toContain('255, 255, 255')
  })
})
