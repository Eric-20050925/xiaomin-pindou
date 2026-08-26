import type { GridData } from '../types'

export const PATTERN_GUIDE_SIZE = 3

type PatternColor = {
  code: string
  hex: string
}

type PatternDrawingOptions = {
  cellSize: number
  originX: number
  originY: number
  coordinateMargin: number
  showCoordinates?: boolean
}

const hexToRgb = (hex: string) => {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16))
  return channels && channels.length >= 3 ? channels : [255, 255, 255]
}

const labelColor = (hex: string) => {
  const rgb = hexToRgb(hex)
  const luminance = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114
  return luminance > 158 ? 'rgba(18, 29, 23, 0.84)' : 'rgba(255, 255, 255, 0.94)'
}

export function drawPatternGrid(
  context: CanvasRenderingContext2D,
  grid: GridData,
  colors: PatternColor[],
  options: PatternDrawingOptions,
) {
  const { cellSize, originX, originY, coordinateMargin, showCoordinates = true } = options
  const patternWidth = grid.width * cellSize
  const patternHeight = grid.height * cellSize

  context.fillStyle = '#ffffff'
  context.fillRect(originX, originY, patternWidth, patternHeight)

  grid.cells.forEach((colorIndex, index) => {
    if (colorIndex < 0) return
    const x = originX + (index % grid.width) * cellSize
    const y = originY + Math.floor(index / grid.width) * cellSize
    const color = colors[colorIndex]
    context.fillStyle = color.hex
    context.fillRect(x, y, cellSize, cellSize)
    context.fillStyle = labelColor(color.hex)
    context.font = `700 ${Math.max(8, Math.min(12, cellSize * 0.4))}px ui-monospace, SFMono-Regular, Consolas, monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(color.code, x + cellSize / 2, y + cellSize / 2, cellSize - 2)
  })

  for (let column = 0; column <= grid.width; column += 1) {
    const guide = column % PATTERN_GUIDE_SIZE === 0
    const x = originX + column * cellSize
    context.beginPath()
    context.moveTo(x, originY)
    context.lineTo(x, originY + patternHeight)
    context.strokeStyle = guide ? 'rgba(199, 139, 51, 0.78)' : 'rgba(40, 53, 46, 0.16)'
    context.lineWidth = guide ? 1.6 : 0.75
    context.stroke()
  }

  for (let row = 0; row <= grid.height; row += 1) {
    const guide = row % PATTERN_GUIDE_SIZE === 0
    const y = originY + row * cellSize
    context.beginPath()
    context.moveTo(originX, y)
    context.lineTo(originX + patternWidth, y)
    context.strokeStyle = guide ? 'rgba(199, 139, 51, 0.78)' : 'rgba(40, 53, 46, 0.16)'
    context.lineWidth = guide ? 1.6 : 0.75
    context.stroke()
  }

  if (!showCoordinates) return
  context.fillStyle = '#17231c'
  context.font = `700 ${Math.max(9, Math.min(12, cellSize * 0.42))}px ui-monospace, SFMono-Regular, Consolas, monospace`
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (let column = 0; column < grid.width; column += 1) {
    const x = originX + (column + 0.5) * cellSize
    context.fillText(String(column + 1), x, originY - coordinateMargin / 2)
    context.fillText(String(column + 1), x, originY + patternHeight + coordinateMargin / 2)
  }

  for (let row = 0; row < grid.height; row += 1) {
    const y = originY + (row + 0.5) * cellSize
    context.fillText(String(row + 1), originX - coordinateMargin / 2, y)
    context.fillText(String(row + 1), originX + patternWidth + coordinateMargin / 2, y)
  }
}
