import type { GridData } from '../types'

export type PatternHealthIssueKind = 'empty' | 'isolated' | 'disconnected' | 'hole' | 'fragile'

export type PatternHealthIssue = {
  id: PatternHealthIssueKind
  kind: PatternHealthIssueKind
  title: string
  detail: string
  cells: number[]
  count: number
  repairLabel?: string
}

export type PatternHealthReport = {
  score: number
  componentCount: number
  issues: PatternHealthIssue[]
}

const neighborIndices = (index: number, width: number, height: number) => {
  const x = index % width
  const y = Math.floor(index / width)
  const neighbors: number[] = []
  if (y > 0) neighbors.push(index - width)
  if (x > 0) neighbors.push(index - 1)
  if (x + 1 < width) neighbors.push(index + 1)
  if (y + 1 < height) neighbors.push(index + width)
  return neighbors
}

const occupiedComponents = (grid: GridData) => {
  const visited = new Uint8Array(grid.cells.length)
  const components: number[][] = []

  grid.cells.forEach((color, start) => {
    if (color < 0 || visited[start]) return
    const component: number[] = []
    const queue = [start]
    visited[start] = 1

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]
      component.push(index)
      for (const next of neighborIndices(index, grid.width, grid.height)) {
        if (visited[next] || grid.cells[next] < 0) continue
        visited[next] = 1
        queue.push(next)
      }
    }
    components.push(component)
  })

  return components.sort((left, right) => right.length - left.length)
}

const fragileCells = (grid: GridData) => grid.cells
  .map((color, index) => ({ color, index }))
  .filter(({ color, index }) => {
    if (color < 0) return false
    const x = index % grid.width
    const y = Math.floor(index / grid.width)
    const occupied = (offsetX: number, offsetY: number) => {
      const nextX = x + offsetX
      const nextY = y + offsetY
      return nextX >= 0 && nextX < grid.width
        && nextY >= 0 && nextY < grid.height
        && grid.cells[nextY * grid.width + nextX] >= 0
    }
    const up = occupied(0, -1)
    const right = occupied(1, 0)
    const down = occupied(0, 1)
    const left = occupied(-1, 0)
    if (left && right && !up && !down) return true
    if (up && down && !left && !right) return true
    if (up && right && !down && !left) return !occupied(1, -1)
    if (right && down && !left && !up) return !occupied(1, 1)
    if (down && left && !up && !right) return !occupied(-1, 1)
    if (left && up && !right && !down) return !occupied(-1, -1)
    return false
  })
  .map(({ index }) => index)

export function analyzePatternHealth(grid: GridData): PatternHealthReport {
  const components = occupiedComponents(grid)
  if (components.length === 0) {
    return {
      score: 0,
      componentCount: 0,
      issues: [{
        id: 'empty',
        kind: 'empty',
        title: '空白图纸',
        detail: '画布中还没有可以检查的拼豆',
        cells: [],
        count: 0,
      }],
    }
  }
  const isolated = components.filter((component) => component.length === 1).flat()
  const disconnectedComponents = components.slice(1).filter((component) => component.length > 1)
  const disconnected = disconnectedComponents.flat()
  const holes = grid.cells
    .map((color, index) => ({ color, index }))
    .filter(({ color, index }) => (
      color < 0
      && neighborIndices(index, grid.width, grid.height).length === 4
      && neighborIndices(index, grid.width, grid.height).every((next) => grid.cells[next] >= 0)
    ))
    .map(({ index }) => index)
  const fragile = fragileCells(grid)
  const issues: PatternHealthIssue[] = []

  if (isolated.length > 0) {
    issues.push({
      id: 'isolated',
      kind: 'isolated',
      title: '孤立豆',
      detail: `${isolated.length} 颗豆没有上下左右支撑`,
      cells: isolated,
      count: isolated.length,
      repairLabel: '移除孤立豆',
    })
  }
  if (disconnected.length > 0) {
    issues.push({
      id: 'disconnected',
      kind: 'disconnected',
      title: '分离区域',
      detail: `${disconnectedComponents.length} 块区域未与最大主体相连`,
      cells: disconnected,
      count: disconnectedComponents.length,
      repairLabel: '连接全部区域',
    })
  }
  if (holes.length > 0) {
    issues.push({
      id: 'hole',
      kind: 'hole',
      title: '单格空洞',
      detail: `${holes.length} 处空格被四周豆子包围`,
      cells: holes,
      count: holes.length,
      repairLabel: '填补空洞',
    })
  }
  if (fragile.length > 0) {
    issues.push({
      id: 'fragile',
      kind: 'fragile',
      title: '薄弱连接',
      detail: `${fragile.length} 颗豆位于单豆宽连接处`,
      cells: fragile,
      count: fragile.length,
    })
  }

  const penalty = Math.min(24, isolated.length * 6)
    + Math.min(30, disconnectedComponents.length * 12)
    + Math.min(15, holes.length * 3)
    + Math.min(31, fragile.length * 2)

  return {
    score: Math.max(0, 100 - penalty),
    componentCount: components.length,
    issues,
  }
}

export function removePatternCells(grid: GridData, indices: number[]): GridData {
  const cells = [...grid.cells]
  indices.forEach((index) => { cells[index] = -1 })
  return { ...grid, cells }
}

export function fillPatternHoles(grid: GridData, indices: number[]): GridData {
  const cells = [...grid.cells]
  indices.forEach((index) => {
    const counts = new Map<number, number>()
    neighborIndices(index, grid.width, grid.height).forEach((neighbor) => {
      const color = grid.cells[neighbor]
      if (color >= 0) counts.set(color, (counts.get(color) ?? 0) + 1)
    })
    const replacement = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
    if (replacement !== undefined) cells[index] = replacement
  })
  return { ...grid, cells }
}
