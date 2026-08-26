import { describe, expect, it } from 'vitest'
import { deltaE2000, rgbToLab } from './color'

describe('color conversion', () => {
  it('maps white and black to the expected Lab lightness range', () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 1)
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 1)
  })

  it('matches the CIEDE2000 published reference pair', () => {
    const distance = deltaE2000(
      [50, 2.6772, -79.7751],
      [50, 0, -82.7485],
    )
    expect(distance).toBeCloseTo(2.0425, 4)
  })

  it('returns zero for identical colors', () => {
    expect(deltaE2000([62, 12, -8], [62, 12, -8])).toBe(0)
  })
})
