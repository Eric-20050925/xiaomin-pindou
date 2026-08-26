import { useEffect, useRef } from 'react'

type Bead = {
  column: number
  row: number
  color: string
  seed: number
}

const GRID_COLUMNS = 32
const GRID_ROWS = 31
const SOURCE_IMAGE = '/assets/home-rooster-beads.png'
const BEAD_COLORS = [
  { color: '#ff4c0a', rgb: [239, 86, 71] },
  { color: '#ffb1a5', rgb: [167, 77, 52] },
  { color: '#a9ddea', rgb: [35, 124, 173] },
] as const

const colorDistance = (left: number[], right: readonly number[]) => Math.sqrt(
  (left[0] - right[0]) ** 2
  + (left[1] - right[1]) ** 2
  + (left[2] - right[2]) ** 2,
)

const readBeads = (image: HTMLImageElement) => {
  const source = document.createElement('canvas')
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const context = source.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, source.width, source.height).data
  const cellWidth = source.width / GRID_COLUMNS
  const cellHeight = source.height / GRID_ROWS
  const beads: Bead[] = []

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const centerX = (column + 0.5) * cellWidth
      const centerY = (row + 0.5) * cellHeight
      const samples: number[][] = []

      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const x = Math.round(centerX + Math.cos(angle) * cellWidth * 0.27)
        const y = Math.round(centerY + Math.sin(angle) * cellHeight * 0.27)
        const offset = (y * source.width + x) * 4
        samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]])
      }

      const average = [0, 1, 2].map((channel) => (
        samples.reduce((total, sample) => total + sample[channel], 0) / samples.length
      ))
      const match = BEAD_COLORS
        .map((candidate) => ({ ...candidate, distance: colorDistance(average, candidate.rgb) }))
        .sort((left, right) => left.distance - right.distance)[0]

      if (match.distance < 86) {
        beads.push({
          column,
          row,
          color: match.color,
          seed: Math.abs(Math.sin((row * GRID_COLUMNS + column + 1) * 91.731)),
        })
      }
    }
  }
  return beads
}

export function BeadHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const image = new Image()
    let beads: Bead[] = []
    let frame = 0
    let width = 0
    let height = 0
    let startedAt = performance.now()
    const pointer = { x: -1000, y: -1000 }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#f3f4f2'
      context.fillRect(0, 0, width, height)

      const mobile = width < 620
      const patternWidth = mobile
        ? width * 1.28
        : Math.min(width * 0.66, height * 1.03 * (GRID_COLUMNS / GRID_ROWS))
      const cellSize = patternWidth / GRID_COLUMNS
      const patternHeight = cellSize * GRID_ROWS
      const originX = mobile ? width * 0.17 : width * 0.54
      const originY = mobile ? height * 0.53 : (height - patternHeight) / 2
      const elapsed = reduceMotion ? 3000 : time - startedAt

      context.save()
      context.strokeStyle = 'rgba(17, 18, 16, 0.075)'
      context.lineWidth = 1
      const gridSize = Math.max(22, cellSize)
      for (let x = originX % gridSize; x < width; x += gridSize) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      for (let y = originY % gridSize; y < height; y += gridSize) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }
      context.restore()

      beads.forEach((bead, index) => {
        const finalX = originX + (bead.column + 0.5) * cellSize
        const finalY = originY + (bead.row + 0.5) * cellSize
        const entrance = Math.min(1, Math.max(0, (elapsed - bead.seed * 520) / 1250))
        const eased = 1 - (1 - entrance) ** 3
        const angle = bead.seed * Math.PI * 8 + index * 0.19
        const scatterDistance = Math.max(width, height) * (0.38 + bead.seed * 0.28)
        let x = finalX + Math.cos(angle) * scatterDistance * (1 - eased)
        let y = finalY + Math.sin(angle) * scatterDistance * (1 - eased)

        if (!reduceMotion && entrance >= 1) {
          y += Math.sin(time * 0.0018 + bead.column * 0.38 + bead.row * 0.22) * 1.2
          const deltaX = x - pointer.x
          const deltaY = y - pointer.y
          const distance = Math.hypot(deltaX, deltaY)
          if (distance < 88 && distance > 0) {
            const force = (1 - distance / 88) * 11
            x += deltaX / distance * force
            y += deltaY / distance * force
          }
        }

        const radius = cellSize * 0.41 * Math.min(1, entrance * 1.2)
        if (radius <= 0) return
        context.save()
        context.globalAlpha = mobile ? 0.58 : 0.98
        context.shadowColor = 'rgba(17, 18, 16, 0.2)'
        context.shadowBlur = Math.max(2, cellSize * 0.16)
        context.shadowOffsetY = Math.max(1, cellSize * 0.08)
        context.fillStyle = bead.color
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
        context.shadowColor = 'transparent'

        context.fillStyle = 'rgba(255, 255, 255, 0.28)'
        context.beginPath()
        context.arc(x - radius * 0.26, y - radius * 0.3, radius * 0.18, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = '#f3f4f2'
        context.beginPath()
        context.arc(x, y, radius * 0.22, 0, Math.PI * 2)
        context.fill()
        context.restore()
      })

      if (!reduceMotion) frame = window.requestAnimationFrame(draw)
    }

    const handlePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top
    }

    const observer = new ResizeObserver(() => {
      resize()
      if (reduceMotion) draw(performance.now())
    })
    observer.observe(canvas)
    window.addEventListener('pointermove', handlePointer, { passive: true })

    image.onload = () => {
      beads = readBeads(image)
      startedAt = performance.now()
      resize()
      draw(startedAt)
    }
    image.src = SOURCE_IMAGE

    return () => {
      observer.disconnect()
      window.removeEventListener('pointermove', handlePointer)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="bead-hero-canvas" aria-hidden="true" />
}
