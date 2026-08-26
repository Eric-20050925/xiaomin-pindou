import { useEffect, useRef } from 'react'
import { drawPatternGrid } from '../lib/patternDrawing'
import type { BeadView, GridData, PaletteColor } from '../types'

type GridCanvasProps = {
  grid: GridData
  palette: PaletteColor[]
  view: BeadView
  zoom: number
  highlightedCells?: number[]
  onCellAction: (index: number, isGestureStart: boolean) => void
}

const contrastColor = (rgb: [number, number, number]) =>
  rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 154
    ? 'rgba(18, 29, 23, 0.82)'
    : 'rgba(255, 255, 255, 0.9)'

export function GridCanvas({ grid, palette, view, zoom, highlightedCells = [], onCellAction }: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastIndexRef = useRef(-1)
  const patternView = view === 'pattern'
  const baseCellSize = patternView ? 22 : grid.width <= 32 ? 22 : grid.width <= 60 ? 15 : 10
  const cellSize = Math.max(5, Math.round(baseCellSize * zoom / 100))
  const coordinateMargin = patternView ? Math.max(24, Math.round(cellSize * 1.2)) : 0
  const cssWidth = grid.width * cellSize + coordinateMargin * 2
  const cssHeight = grid.height * cellSize + coordinateMargin * 2

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.clearRect(0, 0, cssWidth, cssHeight)
    context.fillStyle = '#f7f8f5'
    context.fillRect(0, 0, cssWidth, cssHeight)

    if (patternView) {
      drawPatternGrid(context, grid, palette, {
        cellSize,
        originX: coordinateMargin,
        originY: coordinateMargin,
        coordinateMargin,
      })
    } else {
      grid.cells.forEach((colorIndex, index) => {
        const x = (index % grid.width) * cellSize
        const y = Math.floor(index / grid.width) * cellSize

        if (colorIndex < 0) {
          const checkerSize = Math.max(3, cellSize / 2)
          context.fillStyle = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2
            ? '#eef0ec'
            : '#ffffff'
          context.fillRect(x, y, cellSize, cellSize)
        } else {
          const color = palette[colorIndex]
          if (view === 'square') {
            context.fillStyle = color.hex
            context.fillRect(x, y, cellSize, cellSize)
          } else {
            context.fillStyle = '#f7f8f5'
            context.fillRect(x, y, cellSize, cellSize)
            context.fillStyle = color.hex
            context.beginPath()
            context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.44, 0, Math.PI * 2)
            context.fill()
            if (cellSize >= 9) {
              context.fillStyle = 'rgba(255, 255, 255, 0.72)'
              context.beginPath()
              context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.1, 0, Math.PI * 2)
              context.fill()
            }
          }

          if (view === 'square' && cellSize >= 25) {
            context.fillStyle = contrastColor(color.rgb)
            context.font = `600 ${Math.max(8, cellSize * 0.32)}px ui-monospace, monospace`
            context.textAlign = 'center'
            context.textBaseline = 'middle'
            context.fillText(color.code, x + cellSize / 2, y + cellSize / 2)
          }
        }

        context.strokeStyle = index % grid.width % 5 === 0 || Math.floor(index / grid.width) % 5 === 0
          ? 'rgba(24, 34, 29, 0.28)'
          : 'rgba(24, 34, 29, 0.1)'
        context.lineWidth = 1
        context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)
      })
    }

    highlightedCells.forEach((index) => {
      const x = coordinateMargin + (index % grid.width) * cellSize
      const y = coordinateMargin + Math.floor(index / grid.width) * cellSize
      context.fillStyle = 'rgba(255, 76, 10, 0.2)'
      context.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2)
      context.strokeStyle = '#ff4c0a'
      context.lineWidth = Math.max(2, Math.round(cellSize * 0.1))
      context.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2)
    })
  }, [cellSize, coordinateMargin, cssHeight, cssWidth, grid, highlightedCells, palette, patternView, view])

  const indexFromPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const localX = (event.clientX - bounds.left) * cssWidth / bounds.width - coordinateMargin
    const localY = (event.clientY - bounds.top) * cssHeight / bounds.height - coordinateMargin
    const x = Math.floor(localX / cellSize)
    const y = Math.floor(localY / cellSize)
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return -1
    return y * grid.width + x
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    drawingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const index = indexFromPointer(event)
    lastIndexRef.current = index
    if (index >= 0) onCellAction(index, true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const index = indexFromPointer(event)
    if (index >= 0 && index !== lastIndexRef.current) {
      lastIndexRef.current = index
      onCellAction(index, false)
    }
  }

  const stopDrawing = () => {
    drawingRef.current = false
    lastIndexRef.current = -1
  }

  return (
    <canvas
      ref={canvasRef}
      className="pattern-canvas"
      aria-label={patternView
        ? `${grid.width} 乘 ${grid.height} 带坐标拼豆图纸`
        : `${grid.width} 乘 ${grid.height} 拼豆画布`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrawing}
      onPointerCancel={stopDrawing}
      onPointerLeave={stopDrawing}
    />
  )
}
