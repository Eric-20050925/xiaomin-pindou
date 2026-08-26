import type { GridData } from '../types'

export type GridEditResult = {
  grid: GridData
  changed: number
}

const neighbors = (index: number, width: number, height: number) => {
  const x = index % width
  const y = Math.floor(index / width)
  const result: number[] = []
  if (y > 0) result.push(index - width)
  if (x > 0) result.push(index - 1)
  if (x + 1 < width) result.push(index + 1)
  if (y + 1 < height) result.push(index + width)
  return result
}

export function floodFillGrid(grid: GridData, start: number, replacement: number): GridEditResult {
  const source = grid.cells[start]
  if (source === undefined || source === replacement) return { grid, changed: 0 }

  const cells = [...grid.cells]
  const visited = new Uint8Array(cells.length)
  const queue = [start]
  visited[start] = 1
  let changed = 0

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]
    if (cells[index] !== source) continue
    cells[index] = replacement
    changed += 1
    neighbors(index, grid.width, grid.height).forEach((next) => {
      if (visited[next] || cells[next] !== source) return
      visited[next] = 1
      queue.push(next)
    })
  }

  return { grid: { ...grid, cells }, changed }
}

export function replaceGridColor(grid: GridData, source: number, replacement: number): GridEditResult {
  if (source < 0 || source === replacement) return { grid, changed: 0 }
  let changed = 0
  const cells = grid.cells.map((color) => {
    if (color !== source) return color
    changed += 1
    return replacement
  })
  return changed > 0 ? { grid: { ...grid, cells }, changed } : { grid, changed: 0 }
}
