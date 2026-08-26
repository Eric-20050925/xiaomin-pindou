import { describe, expect, it } from 'vitest'
import { panScrollPosition } from './canvasNavigation'

describe('canvas browsing drag', () => {
  it('moves the viewport opposite to the pointer delta', () => {
    expect(panScrollPosition(
      { x: 200, y: 300 },
      { x: 100, y: 100 },
      { x: 70, y: 140 },
    )).toEqual({ left: 230, top: 260 })
  })
})
