import { describe, expect, it } from 'vitest'
import { detailPresetForDimensions, dimensionsForDetail } from './gridDetail'

describe('grid detail dimensions', () => {
  it('uses the selected detail size for the longest landscape edge', () => {
    expect(dimensionsForDetail(1600, 900, 48)).toEqual({ width: 48, height: 27 })
  })

  it('uses the selected detail size for the longest portrait edge', () => {
    expect(dimensionsForDetail(900, 1600, 64)).toEqual({ width: 36, height: 64 })
  })

  it('keeps very narrow images inside the supported dimension range', () => {
    expect(dimensionsForDetail(100, 1000, 24)).toEqual({ width: 8, height: 24 })
  })

  it('recognizes preset and custom grid dimensions', () => {
    expect(detailPresetForDimensions(24, 18)).toBe('draft')
    expect(detailPresetForDimensions(37, 24)).toBe('custom')
  })
})
