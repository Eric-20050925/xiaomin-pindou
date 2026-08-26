import { deltaE2000, rgbToLab } from './color'
import type { ColorStyle, GridData, LabColor, PaletteColor } from '../types'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export const nearestColorIndexFromLab = (
  lab: LabColor,
  palette: PaletteColor[],
  allowedIndices?: number[],
) => {
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

export const nearestColorIndex = (
  rgb: [number, number, number],
  palette: PaletteColor[],
  allowedIndices?: number[],
) => {
  return nearestColorIndexFromLab(rgbToLab(rgb), palette, allowedIndices)
}

/**
 * Accentuates real, local color variation before palette matching. Flat areas stay
 * unchanged while subtle highlights, shadows, and hue changes survive downsampling.
 */
export function enhancePerceptualDetail(
  source: Array<LabColor | null>,
  width: number,
  height: number,
) {
  return source.map((lab, index) => {
    if (!lab) return null
    const x = index % width
    const y = Math.floor(index / width)
    const average: LabColor = [0, 0, 0]
    let samples = 0

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const nextX = x + offsetX
        const nextY = y + offsetY
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
        const neighbor = source[nextY * width + nextX]
        if (!neighbor) continue
        average[0] += neighbor[0]
        average[1] += neighbor[1]
        average[2] += neighbor[2]
        samples += 1
      }
    }

    if (samples < 2) return lab
    average[0] /= samples
    average[1] /= samples
    average[2] /= samples
    return [
      clamp(lab[0] + clamp((lab[0] - average[0]) * 0.55, -7, 7), 0, 100),
      lab[1] + clamp((lab[1] - average[1]) * 0.18, -3, 3),
      lab[2] + clamp((lab[2] - average[2]) * 0.18, -3, 3),
    ] as LabColor
  })
}

export function applyColorStyle(
  source: Array<LabColor | null>,
  width: number,
  height: number,
  style: ColorStyle,
) {
  if (style === 'faithful') return source
  if (style === 'cartoon') {
    return source.map((lab) => {
      if (!lab) return null
      const tone = clamp(50 + (lab[0] - 50) * 1.14, 0, 100)
      const chroma = Math.hypot(lab[1], lab[2])
      const chromaScale = chroma > 0 ? Math.min(chroma * 1.22, 100) / chroma : 1
      return [
        clamp(Math.round(tone / 12) * 12, 6, 96),
        Math.round(lab[1] * chromaScale / 8) * 8,
        Math.round(lab[2] * chromaScale / 8) * 8,
      ] as LabColor
    })
  }
  const detailed = enhancePerceptualDetail(source, width, height)
  const toneContrast = style === 'vivid' ? 1.12 : 1.04
  const chromaScale = style === 'vivid' ? 1.18 : 1.02
  const chromaLimit = style === 'vivid' ? 105 : 86

  return detailed.map((lab) => {
    if (!lab) return null
    const chroma = Math.hypot(lab[1], lab[2])
    const styledChroma = Math.min(chroma * chromaScale, chromaLimit)
    const scale = chroma > 0 ? styledChroma / chroma : 1
    return [
      clamp(50 + (lab[0] - 50) * toneContrast, 0, 100),
      lab[1] * scale,
      lab[2] * scale,
    ] as LabColor
  })
}

export function selectRepresentativePaletteIndices(
  counts: Map<number, number>,
  palette: PaletteColor[],
  maximum: number,
  style: ColorStyle = 'harmonized',
) {
  const candidates = [...counts.entries()]
  const limit = Math.max(2, Math.min(maximum, candidates.length))
  if (candidates.length <= limit) return candidates.map(([index]) => index)

  candidates.sort((left, right) => right[1] - left[1])
  const selected = [candidates[0][0]]
  const selectedSet = new Set(selected)
  const largestCount = candidates[0][1]

  while (selected.length < limit) {
    let bestIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY
    for (const [index, count] of candidates) {
      if (selectedSet.has(index)) continue
      const nearestSelectedDistance = Math.min(
        ...selected.map((selectedIndex) => deltaE2000(palette[index].lab, palette[selectedIndex].lab)),
      )
      const frequencyWeight = Math.sqrt(count / largestCount)
      const diversityScale = style === 'vivid' ? 6 : style === 'cartoon' ? 8 : style === 'faithful' ? 9 : 12
      const score = frequencyWeight * (1 + nearestSelectedDistance / diversityScale)
      if (score > bestScore) {
        bestIndex = index
        bestScore = score
      }
    }
    if (bestIndex < 0) break
    selected.push(bestIndex)
    selectedSet.add(bestIndex)
  }

  return selected
}

function coordinatedColorIndex(
  lab: LabColor,
  palette: PaletteColor[],
  selectedIndices: number[],
  counts: Map<number, number>,
  style: ColorStyle,
) {
  if (style === 'faithful') return nearestColorIndexFromLab(lab, palette, selectedIndices)
  const largestCount = Math.max(1, ...counts.values())
  const cohesionStrength = style === 'cartoon' ? 2.1 : style === 'harmonized' ? 1.25 : 0.35
  let bestIndex = selectedIndices[0] ?? 0
  let bestScore = Number.POSITIVE_INFINITY

  for (const index of selectedIndices) {
    const usageWeight = Math.sqrt((counts.get(index) ?? 0) / largestCount)
    const score = deltaE2000(lab, palette[index].lab) - usageWeight * cohesionStrength
    if (score < bestScore) {
      bestIndex = index
      bestScore = score
    }
  }
  return bestIndex
}

export function quantizeImage(
  image: HTMLImageElement,
  width: number,
  height: number,
  maxColors: number,
  palette: PaletteColor[],
  colorStyle: ColorStyle = 'harmonized',
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
  const sourceLabs: Array<LabColor | null> = []

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] < 64) {
      sourceLabs.push(null)
      continue
    }

    const rgb: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
    sourceLabs.push(rgbToLab(rgb))
  }

  const detailedLabs = applyColorStyle(sourceLabs, width, height, colorStyle)
  const initialMatches: number[] = []
  const counts = new Map<number, number>()
  for (const lab of detailedLabs) {
    if (!lab) {
      initialMatches.push(-1)
      continue
    }
    const match = nearestColorIndexFromLab(lab, palette)
    initialMatches.push(match)
    counts.set(match, (counts.get(match) ?? 0) + 1)
  }

  const selectedIndices = selectRepresentativePaletteIndices(counts, palette, maxColors, colorStyle)
  const selectedSet = new Set(selectedIndices)

  const cells = detailedLabs.map((lab, index) => {
    if (!lab) return -1
    const initialMatch = initialMatches[index]
    return colorStyle === 'faithful' && selectedSet.has(initialMatch)
      ? initialMatch
      : coordinatedColorIndex(lab, palette, selectedIndices, counts, colorStyle)
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
