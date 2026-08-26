import { useEffect, useRef } from 'react'
import { Image, ScanSearch, X } from 'lucide-react'
import type { GridData, PaletteColor } from '../types'

type ComparisonDialogProps = {
  sourceName: string
  originalUrl: string
  subjectUrl?: string
  subjectEnabled: boolean
  grid: GridData
  palette: PaletteColor[]
  paletteName: string
  onClose: () => void
}

type PatternPreviewProps = {
  grid: GridData
  palette: PaletteColor[]
}

function PatternPreview({ grid, palette }: PatternPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, bounds.width, bounds.height)

      const cellSize = Math.min(bounds.width / grid.width, bounds.height / grid.height)
      const patternWidth = cellSize * grid.width
      const patternHeight = cellSize * grid.height
      const originX = (bounds.width - patternWidth) / 2
      const originY = (bounds.height - patternHeight) / 2
      context.fillStyle = '#f3f4f2'
      context.fillRect(0, 0, bounds.width, bounds.height)

      grid.cells.forEach((colorIndex, index) => {
        const x = originX + index % grid.width * cellSize
        const y = originY + Math.floor(index / grid.width) * cellSize
        context.fillStyle = colorIndex >= 0 ? palette[colorIndex]?.hex ?? '#ffffff' : '#ffffff'
        context.fillRect(x, y, Math.ceil(cellSize), Math.ceil(cellSize))
      })

      if (cellSize >= 5) {
        context.strokeStyle = 'rgba(17, 18, 16, 0.13)'
        context.lineWidth = 1
        for (let column = 0; column <= grid.width; column += 1) {
          const x = originX + column * cellSize
          context.beginPath()
          context.moveTo(x, originY)
          context.lineTo(x, originY + patternHeight)
          context.stroke()
        }
        for (let row = 0; row <= grid.height; row += 1) {
          const y = originY + row * cellSize
          context.beginPath()
          context.moveTo(originX, y)
          context.lineTo(originX + patternWidth, y)
          context.stroke()
        }
      }
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()
    return () => observer.disconnect()
  }, [grid, palette])

  return <canvas ref={canvasRef} aria-label={`${grid.width} 乘 ${grid.height} 拼豆预览`} />
}

export function ComparisonDialog({
  sourceName,
  originalUrl,
  subjectUrl,
  subjectEnabled,
  grid,
  palette,
  paletteName,
  onClose,
}: ComparisonDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="comparison-overlay" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="comparison-dialog" role="dialog" aria-modal="true" aria-labelledby="comparison-title">
        <header className="comparison-header">
          <div>
            <span>BEFORE / SUBJECT / PATTERN</span>
            <h2 id="comparison-title">转换前后对照</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} title="关闭对照" aria-label="关闭对照"><X size={20} /></button>
        </header>

        <div className="comparison-grid">
          <article className="comparison-column">
            <header><span>01</span><strong>原图</strong><small>{sourceName}</small></header>
            <div className="comparison-visual image-preview">
              <img src={originalUrl} alt={`${sourceName} 原图`} />
            </div>
            <footer><Image size={14} /> 上传内容</footer>
          </article>

          <article className="comparison-column">
            <header><span>02</span><strong>主体</strong><small>{subjectEnabled ? '提取结果' : '未启用'}</small></header>
            <div className="comparison-visual image-preview">
              {subjectUrl ? (
                <img src={subjectUrl} alt={`${sourceName} 主体提取结果`} />
              ) : (
                <div className="comparison-unavailable">
                  <ScanSearch size={26} />
                  <strong>{subjectEnabled ? '等待生成主体结果' : '主体提取未启用'}</strong>
                  <span>{subjectEnabled ? '完成一次重新生成后将在这里显示' : '原图将直接参与颜色转换'}</span>
                </div>
              )}
            </div>
            <footer><ScanSearch size={14} /> {subjectUrl ? '透明背景主体' : '暂无预览'}</footer>
          </article>

          <article className="comparison-column pattern-column">
            <header><span>03</span><strong>图纸</strong><small>{grid.width} × {grid.height}</small></header>
            <div className="comparison-visual pattern-preview">
              <PatternPreview grid={grid} palette={palette} />
            </div>
            <footer>{paletteName} · {grid.cells.filter((cell) => cell >= 0).length.toLocaleString('zh-CN')} 颗</footer>
          </article>
        </div>
      </section>
    </div>
  )
}
