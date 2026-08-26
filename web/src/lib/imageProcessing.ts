import { deltaE2000, rgbToLab } from './color'
import type { GridData, PaletteColor } from '../types'

export const nearestColorIndex = (
  rgb: [number, number, number],
  palette: PaletteColor[],
  allowedIndices?: number[],
) => {
  const lab = rgbToLab(rgb)
  const candidates = allowedIndices ?? palette.map((_, index) => index)
  let nearest = candidates[0] ?? 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const index of candidates) {
    const distance = deltaE2000(lab, palette[index].lab)
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  }

  return nearest
}

export function quantizeImage(
  image: HTMLImageElement,
  width: number,
  height: number,
  maxColors: number,
  palette: PaletteColor[],
): GridData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前浏览器无法读取图片画布')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, width, height)

  const targetRatio = width / height
  const sourceRatio = image.naturalWidth / image.naturalHeight
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = image.naturalWidth
  let sourceHeight = image.naturalHeight

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio
    sourceX = (image.naturalWidth - sourceWidth) / 2
  } else {
    sourceHeight = image.naturalWidth / targetRatio
    sourceY = (image.naturalHeight - sourceHeight) / 2
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  )

  const pixels = context.getImageData(0, 0, width, height).data
  const sourceColors: Array<[number, number, number] | null> = []
  const initialMatches: number[] = []
  const counts = new Map<number, number>()

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] < 64) {
      sourceColors.push(null)
      initialMatches.push(-1)
      continue
    }

    const rgb: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
    const match = nearestColorIndex(rgb, palette)
    sourceColors.push(rgb)
    initialMatches.push(match)
    counts.set(match, (counts.get(match) ?? 0) + 1)
  }

  const selectedIndices = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, Math.max(2, Math.min(maxColors, counts.size)))
    .map(([index]) => index)

  const cells = sourceColors.map((rgb, index) => {
    if (!rgb) return -1
    const initialMatch = initialMatches[index]
    return selectedIndices.includes(initialMatch)
      ? initialMatch
      : nearestColorIndex(rgb, palette, selectedIndices)
  })

  return { width, height, cells }
}

export function remapGridPalette(
  grid: GridData,
  sourcePalette: PaletteColor[],
  targetPalette: PaletteColor[],
): GridData {
  const mappedIndices = new Map<number, number>()
  const cells = grid.cells.map((colorIndex) => {
    if (colorIndex < 0) return -1
    const sourceColor = sourcePalette[colorIndex]
    if (!sourceColor) return -1
    const cached = mappedIndices.get(colorIndex)
    if (cached !== undefined) return cached
    const mapped = nearestColorIndex(sourceColor.rgb, targetPalette)
    mappedIndices.set(colorIndex, mapped)
    return mapped
  })
  return { ...grid, cells }
}

type GridPoint = { x: number; y: number }

const gridNeighbors = [
  [0, -1],
  [-1, 0], [1, 0],
  [0, 1],
] as const

const findOccupiedComponents = (grid: GridData) => {
  const visited = new Uint8Array(grid.cells.length)
  const components: number[][] = []

  grid.cells.forEach((colorIndex, start) => {
    if (colorIndex < 0 || visited[start]) return
    const component: number[] = []
    const queue = [start]
    visited[start] = 1

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]
      component.push(index)
      const x = index % grid.width
      const y = Math.floor(index / grid.width)

      for (const [offsetX, offsetY] of gridNeighbors) {
        const nextX = x + offsetX
        const nextY = y + offsetY
        if (nextX < 0 || nextX >= grid.width || nextY < 0 || nextY >= grid.height) continue
        const next = nextY * grid.width + nextX
        if (visited[next] || grid.cells[next] < 0) continue
        visited[next] = 1
        queue.push(next)
      }
    }

    components.push(component)
  })

  return components.sort((left, right) => right.length - left.length)
}

const shortestBridge = (
  width: number,
  height: number,
  connected: Uint8Array,
  targets: Uint8Array,
): GridPoint[] => {
  const cellCount = width * height
  const visited = new Uint8Array(cellCount)
  const previous = new Int32Array(cellCount).fill(-1)
  const queue: number[] = []

  connected.forEach((value, index) => {
    if (!value) return
    visited[index] = 1
    queue.push(index)
  })

  let target = -1
  for (let cursor = 0; cursor < queue.length && target < 0; cursor += 1) {
    const index = queue[cursor]
    const x = index % width
    const y = Math.floor(index / width)

    for (const [offsetX, offsetY] of gridNeighbors) {
      const nextX = x + offsetX
      const nextY = y + offsetY
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
      const next = nextY * width + nextX
      if (visited[next]) continue
      visited[next] = 1
      previous[next] = index
      if (targets[next]) {
        target = next
        break
      }
      queue.push(next)
    }
  }

  if (target < 0) return []
  const path: GridPoint[] = []
  for (let index = target; index >= 0 && !connected[index]; index = previous[index]) {
    path.push({ x: index % width, y: Math.floor(index / width) })
  }
  return path
}

const fillBoundedGaps = (
  sourceCells: number[],
  width: number,
  height: number,
  transitionColor: number,
  maximumGap: number,
) => {
  const cells = [...sourceCells]
  const fillLine = (indices: number[]) => {
    let previousOccupied = -1
    indices.forEach((index, position) => {
      if (cells[index] < 0) return
      const gap = position - previousOccupied - 1
      if (previousOccupied >= 0 && gap > 0 && gap <= maximumGap) {
        for (let fill = previousOccupied + 1; fill < position; fill += 1) {
          const fillIndex = indices[fill]
          if (cells[fillIndex] < 0) cells[fillIndex] = transitionColor
        }
      }
      previousOccupied = position
    })
  }

  for (let y = 0; y < height; y += 1) {
    fillLine(Array.from({ length: width }, (_, x) => y * width + x))
  }
  for (let x = 0; x < width; x += 1) {
    fillLine(Array.from({ length: height }, (_, y) => y * width + x))
  }
  return cells
}

/**
 * Builds a background-colored support area and guarantees that every occupied bead
 * is connected through its top, right, bottom, or left edge.
 */
export function connectSubjectRegions(grid: GridData, transitionColor: number): GridData {
  const maximumGap = Math.min(10, Math.max(2, Math.round(Math.min(grid.width, grid.height) * 0.16)))
  let cells = fillBoundedGaps(
    fillBoundedGaps(grid.cells, grid.width, grid.height, transitionColor, maximumGap),
    grid.width,
    grid.height,
    transitionColor,
    maximumGap,
  )
  const components = findOccupiedComponents({ ...grid, cells })
  if (components.length < 2) return { ...grid, cells }

  const connected = new Uint8Array(cells.length)
  components[0].forEach((index) => { connected[index] = 1 })
  const pending = new Set(components.slice(1).flat())
  const shortestSide = Math.min(grid.width, grid.height)
  const corridorRadius = shortestSide > 96 ? 3 : shortestSide > 48 ? 2 : 1

  while (pending.size > 0) {
    const targets = new Uint8Array(cells.length)
    pending.forEach((index) => { targets[index] = 1 })
    const path = shortestBridge(grid.width, grid.height, connected, targets)
    if (path.length === 0) break

    const reachedIndex = path[0].y * grid.width + path[0].x
    const reachedRegion = components.find((region) => region.includes(reachedIndex))
    if (!reachedRegion) break

    for (const { x, y } of path) {
      for (let offsetY = -corridorRadius; offsetY <= corridorRadius; offsetY += 1) {
        for (let offsetX = -corridorRadius; offsetX <= corridorRadius; offsetX += 1) {
          if (offsetX ** 2 + offsetY ** 2 > corridorRadius ** 2) continue
          const nextX = x + offsetX
          const nextY = y + offsetY
          if (nextX < 0 || nextX >= grid.width || nextY < 0 || nextY >= grid.height) continue
          const index = nextY * grid.width + nextX
          if (cells[index] < 0) cells[index] = transitionColor
          connected[index] = 1
        }
      }
    }

    reachedRegion.forEach((index) => {
      connected[index] = 1
      pending.delete(index)
    })
  }

  cells = fillBoundedGaps(cells, grid.width, grid.height, transitionColor, maximumGap)
  return { ...grid, cells }
}
