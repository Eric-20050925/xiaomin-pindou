import { describe, expect, it } from 'vitest'
import { floodFillGrid, replaceGridColor } from './gridEditing'
import type { GridData } from '../types'

const grid: GridData = {
  width: 4,
  height: 3,
  cells: [
    1, 1, -1, 1,
    1, 2, -1, 1,
    -1, -1, -1, 1,
  ],
}

describe('grid editing', () => {
  it('fills only the edge-connected region with the same source color', () => {
    const result = floodFillGrid(grid, 0, 7)

    expect(result.changed).toBe(3)
    expect(result.grid.cells).toEqual([
      7, 7, -1, 1,
      7, 2, -1, 1,
      -1, -1, -1, 1,
    ])
  })

  it('can fill a bounded transparent region', () => {
    const result = floodFillGrid(grid, 2, 4)

    expect(result.changed).toBe(5)
    expect(result.grid.cells[2]).toBe(4)
    expect(result.grid.cells[6]).toBe(4)
  })

  it('replaces one color everywhere without changing transparent cells', () => {
    const result = replaceGridColor(grid, 1, 9)

    expect(result.changed).toBe(6)
    expect(result.grid.cells.filter((cell) => cell === 9)).toHaveLength(6)
    expect(result.grid.cells.filter((cell) => cell < 0)).toHaveLength(5)
  })

  it('refuses a global replacement of transparent background', () => {
    const result = replaceGridColor(grid, -1, 9)

    expect(result.changed).toBe(0)
    expect(result.grid).toBe(grid)
  })
})
