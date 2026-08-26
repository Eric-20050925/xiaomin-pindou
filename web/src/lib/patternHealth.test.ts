import { describe, expect, it } from 'vitest'
import { analyzePatternHealth, fillPatternHoles, removePatternCells } from './patternHealth'
import type { GridData } from '../types'

const gridFromRows = (rows: number[][]): GridData => ({
  width: rows[0].length,
  height: rows.length,
  cells: rows.flat(),
})

describe('pattern health analysis', () => {
  it('does not mark an empty grid as ready to make', () => {
    const report = analyzePatternHealth(gridFromRows([
      [-1, -1],
      [-1, -1],
    ]))

    expect(report.score).toBe(0)
    expect(report.issues[0].kind).toBe('empty')
  })

  it('reports a solid block as ready to make', () => {
    const report = analyzePatternHealth(gridFromRows([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]))

    expect(report.score).toBe(100)
    expect(report.componentCount).toBe(1)
    expect(report.issues).toEqual([])
  })

  it('finds isolated beads, separated regions and single-cell holes', () => {
    const report = analyzePatternHealth(gridFromRows([
      [1, 1, 1, -1, -1, -1],
      [1, -1, 1, -1, 2, 2],
      [1, 1, 1, -1, 2, 2],
      [-1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, 3],
    ]))

    expect(report.issues.find((issue) => issue.kind === 'hole')?.count).toBe(1)
    expect(report.issues.find((issue) => issue.kind === 'disconnected')?.count).toBe(1)
    expect(report.issues.find((issue) => issue.kind === 'isolated')?.count).toBe(1)
  })

  it('marks the center of a narrow bridge as fragile', () => {
    const report = analyzePatternHealth(gridFromRows([
      [1, 1, -1, -1, -1],
      [1, 1, 1, 1, 1],
      [-1, -1, -1, 1, 1],
    ]))

    expect(report.issues.find((issue) => issue.kind === 'fragile')?.cells).toContain(7)
  })
})

describe('pattern health repairs', () => {
  it('removes selected cells and fills holes with the majority neighbor color', () => {
    const grid = gridFromRows([
      [2, 2, 2],
      [2, -1, 3],
      [2, 3, 3],
    ])

    expect(removePatternCells(grid, [0]).cells[0]).toBe(-1)
    expect(fillPatternHoles(grid, [4]).cells[4]).toBe(2)
  })
})
