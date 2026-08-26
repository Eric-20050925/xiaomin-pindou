import { describe, expect, it } from 'vitest'
import {
  connectSubjectRegions,
  enhancePerceptualDetail,
  remapGridPalette,
  selectRepresentativePaletteIndices,
} from './imageProcessing'
import { rgbToLab } from './color'
import type { GridData, PaletteColor } from '../types'

const countConnectedCells = (grid: GridData) => {
  const start = grid.cells.findIndex((cell) => cell >= 0)
  if (start < 0) return 0
  const visited = new Set([start])
  const queue = [start]

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]
    const x = index % grid.width
    const y = Math.floor(index / grid.width)
    for (const [offsetX, offsetY] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nextX = x + offsetX
      const nextY = y + offsetY
      if (nextX < 0 || nextX >= grid.width || nextY < 0 || nextY >= grid.height) continue
      const next = nextY * grid.width + nextX
      if (grid.cells[next] < 0 || visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
  return visited.size
}

describe('subject region connection', () => {
  it('adds a transition corridor between substantial separated regions', () => {
    const grid: GridData = {
      width: 9,
      height: 5,
      cells: new Array(45).fill(-1),
    }
    for (const [x, y] of [[1, 1], [1, 2], [2, 1], [2, 2], [6, 2], [6, 3], [7, 2], [7, 3]]) {
      grid.cells[y * grid.width + x] = 3
    }

    const result = connectSubjectRegions(grid, 11)

    expect(result.cells.filter((cell) => cell === 11).length).toBeGreaterThan(0)
    expect(result.cells.some((cell, index) => {
      const x = index % grid.width
      return x >= 3 && x <= 5 && cell === 11
    })).toBe(true)
    expect(result.cells[0]).toBe(-1)
    expect(countConnectedCells(result)).toBe(result.cells.filter((cell) => cell >= 0).length)
  })

  it('connects small regions instead of leaving loose beads', () => {
    const cells = new Array(36).fill(-1)
    ;[[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]].forEach(([x, y]) => {
      cells[y * 6 + x] = 4
    })
    cells[5 * 6 + 5] = 4

    const result = connectSubjectRegions({ width: 6, height: 6, cells }, 9)

    expect(result.cells.filter((cell) => cell === 9).length).toBeGreaterThan(0)
    expect(countConnectedCells(result)).toBe(result.cells.filter((cell) => cell >= 0).length)
  })

  it('treats diagonal contact as disconnected until an edge-sharing bead is added', () => {
    const cells = new Array(9).fill(-1)
    cells[0] = 2
    cells[4] = 2

    const result = connectSubjectRegions({ width: 3, height: 3, cells }, 7)

    expect(result.cells.filter((cell) => cell === 7).length).toBeGreaterThan(0)
    expect(countConnectedCells(result)).toBe(result.cells.filter((cell) => cell >= 0).length)
  })

  it('can recolor the same bridge directly from its unconnected base grid', () => {
    const cells = new Array(21).fill(-1)
    ;[[0, 1], [1, 1], [5, 1], [6, 1]].forEach(([x, y]) => { cells[y * 7 + x] = 2 })
    const base = { width: 7, height: 3, cells }

    const first = connectSubjectRegions(base, 6)
    const second = connectSubjectRegions(base, 9)

    expect(first.cells.filter((cell) => cell === 6).length).toBeGreaterThan(0)
    expect(second.cells.filter((cell) => cell === 9).length).toBeGreaterThan(0)
    expect(second.cells.includes(6)).toBe(false)
  })
})

describe('palette remapping', () => {
  const color = (code: string, rgb: [number, number, number]): PaletteColor => ({
    code,
    rgb,
    hex: '#000000',
    group: 'A',
    lab: rgbToLab(rgb),
  })

  it('preserves empty cells and maps occupied cells to the nearest target color', () => {
    const source = [color('RED', [250, 10, 10]), color('BLUE', [10, 10, 250])]
    const target = [color('R', [240, 20, 20]), color('B', [20, 20, 240])]
    const result = remapGridPalette({ width: 3, height: 1, cells: [0, -1, 1] }, source, target)

    expect(result.cells).toEqual([0, -1, 1])
  })
})

describe('detailed color quantization', () => {
  const color = (code: string, rgb: [number, number, number]): PaletteColor => ({
    code,
    rgb,
    hex: '#000000',
    group: 'A',
    lab: rgbToLab(rgb),
  })

  it('keeps flat color areas unchanged', () => {
    const lab: [number, number, number] = [50, 30, 20]
    expect(enhancePerceptualDetail([lab, lab, lab], 3, 1)).toEqual([lab, lab, lab])
  })

  it('strengthens subtle local highlights and shadows', () => {
    const result = enhancePerceptualDetail([
      [50, 30, 20],
      [60, 30, 20],
      [50, 30, 20],
    ], 3, 1)
    expect(result[0]?.[0]).toBeLessThan(50)
    expect(result[1]?.[0]).toBeGreaterThan(60)
    expect(result[2]?.[0]).toBeLessThan(50)
  })

  it('keeps a rarer distinct shade when the color limit is tight', () => {
    const palette = [
      color('RED', [220, 20, 20]),
      color('NEAR_RED', [218, 22, 22]),
      color('HIGHLIGHT', [255, 150, 120]),
    ]
    const selected = selectRepresentativePaletteIndices(new Map([
      [0, 100],
      [1, 80],
      [2, 20],
    ]), palette, 2)
    expect(selected).toEqual([0, 2])
  })
})
