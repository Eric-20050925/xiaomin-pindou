import { useEffect, useRef } from 'react'
import { Check, Palette, X } from 'lucide-react'
import { COLOR_STYLES } from '../config/colorStyles'
import type { ColorStyle, GridData, PaletteColor } from '../types'

export type StylePreviewVariant = {
  style: ColorStyle
  baseGrid: GridData
  grid: GridData
}

type StylePreviewDialogProps = {
  variants: StylePreviewVariant[]
  palette: PaletteColor[]
  activeStyle: ColorStyle
  progress: number
  onSelect: (variant: StylePreviewVariant) => void
  onClose: () => void
}

function StyleCanvas({ grid, palette }: { grid: GridData; palette: PaletteColor[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = grid.width
    canvas.height = grid.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, grid.width, grid.height)
    grid.cells.forEach((colorIndex, index) => {
      if (colorIndex < 0) return
      context.fillStyle = palette[colorIndex]?.hex ?? '#ffffff'
      context.fillRect(index % grid.width, Math.floor(index / grid.width), 1, 1)
    })
  }, [grid, palette])

  return <canvas ref={canvasRef} aria-label={`${grid.width} 乘 ${grid.height} 风格预览`} />
}

export function StylePreviewDialog({
  variants,
  palette,
  activeStyle,
  progress,
  onSelect,
  onClose,
}: StylePreviewDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const variantByStyle = new Map(variants.map((variant) => [variant.style, variant]))

  return (
    <div className="style-preview-overlay" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="style-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="style-preview-title">
        <header className="style-preview-header">
          <div>
            <span>STYLE CONTACT SHEET</span>
            <h2 id="style-preview-title">选择配色风格</h2>
            <p>同一张图、同一色库和颜色数量，点击预览即可应用</p>
          </div>
          <button type="button" autoFocus onClick={onClose} title="关闭风格预览" aria-label="关闭风格预览"><X size={20} /></button>
        </header>

        <div className="style-preview-progress" aria-label={`风格预览生成进度 ${progress}%`}>
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="style-preview-grid">
          {COLOR_STYLES.map((style, index) => {
            const variant = variantByStyle.get(style.id)
            const colorCount = variant
              ? new Set(variant.grid.cells.filter((cell) => cell >= 0)).size
              : 0
            return (
              <button
                type="button"
                className={`style-preview-card ${activeStyle === style.id ? 'active' : ''}`}
                key={style.id}
                disabled={!variant}
                onClick={() => variant && onSelect(variant)}
              >
                <span className="style-preview-visual">
                  {variant ? (
                    <StyleCanvas grid={variant.grid} palette={palette} />
                  ) : (
                    <span className="style-preview-loading"><i />正在生成</span>
                  )}
                </span>
                <span className="style-preview-copy">
                  <i>{String(index + 1).padStart(2, '0')}</i>
                  <strong>{style.label}</strong>
                  <small>{variant ? `${colorCount} 色 · ${style.description}` : style.description}</small>
                  {activeStyle === style.id && <b><Check size={12} /> 当前</b>}
                </span>
              </button>
            )
          })}
        </div>

        <footer className="style-preview-footer">
          <Palette size={15} /> 已生成 {variants.length} / {COLOR_STYLES.length} 种风格
        </footer>
      </section>
    </div>
  )
}
