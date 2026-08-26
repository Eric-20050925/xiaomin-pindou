import { drawPatternGrid, PATTERN_GUIDE_SIZE } from './patternDrawing'
import type { GridData, SavedProject } from '../types'

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function saveProject(title: string, grid: GridData, paletteId: string) {
  const project: SavedProject = {
    schema: 'pindou-project',
    version: 1,
    title,
    paletteId,
    createdAt: new Date().toISOString(),
    ...grid,
  }
  downloadBlob(
    new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
    `${title || '未命名图纸'}.pindou.json`,
  )
}

export async function readProject(file: File): Promise<SavedProject> {
  const project = JSON.parse(await file.text()) as Partial<SavedProject>
  const isValid = project.schema === 'pindou-project'
    && project.version === 1
    && typeof project.paletteId === 'string'
    && Number.isInteger(project.width)
    && Number.isInteger(project.height)
    && Array.isArray(project.cells)
    && project.cells.length === Number(project.width) * Number(project.height)

  if (!isValid) throw new Error('无法识别这个工程文件')
  return project as SavedProject
}

export function exportPatternPng(
  title: string,
  grid: GridData,
  colors: { code: string; hex: string }[],
  paletteTitle = '拼豆参考色库',
) {
  const cellSize = 24
  const coordinateMargin = 30
  const headerHeight = 78
  const footerHeight = 38
  const counts = new Map<number, number>()
  grid.cells.forEach((colorIndex) => {
    if (colorIndex >= 0) counts.set(colorIndex, (counts.get(colorIndex) ?? 0) + 1)
  })
  const usage = [...counts.entries()].sort((left, right) => right[1] - left[1])
  const patternWidth = grid.width * cellSize + coordinateMargin * 2
  const legendItemWidth = 112
  const legendColumns = Math.max(1, Math.floor((patternWidth - 32) / legendItemWidth))
  const legendRows = Math.max(1, Math.ceil(usage.length / legendColumns))
  const legendHeight = 38 + legendRows * 32
  const canvas = document.createElement('canvas')
  canvas.width = patternWidth
  canvas.height = headerHeight + coordinateMargin * 2 + grid.height * cellSize + legendHeight + footerHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法导出画布')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#18221d'
  context.font = '600 20px system-ui, sans-serif'
  context.fillText(title || '未命名图纸', 16, 28)
  context.fillStyle = '#68736d'
  context.font = '12px system-ui, sans-serif'
  context.fillText(`${paletteTitle} · ${grid.width} × ${grid.height} · ${PATTERN_GUIDE_SIZE} × ${PATTERN_GUIDE_SIZE} 辅助线`, 16, 50)

  drawPatternGrid(context, grid, colors, {
    cellSize,
    originX: coordinateMargin,
    originY: headerHeight + coordinateMargin,
    coordinateMargin,
  })

  const legendTop = headerHeight + coordinateMargin * 2 + grid.height * cellSize
  context.fillStyle = '#f6f7f4'
  context.fillRect(0, legendTop, canvas.width, legendHeight)
  context.fillStyle = '#26342c'
  context.font = '700 12px system-ui, sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillText('色号用量', 16, legendTop + 23)

  usage.forEach(([colorIndex, count], index) => {
    const column = index % legendColumns
    const row = Math.floor(index / legendColumns)
    const x = 16 + column * legendItemWidth
    const y = legendTop + 34 + row * 32
    const color = colors[colorIndex]
    context.fillStyle = color.hex
    context.fillRect(x, y, 20, 20)
    context.strokeStyle = 'rgba(24, 35, 29, 0.18)'
    context.strokeRect(x + 0.5, y + 0.5, 19, 19)
    context.fillStyle = '#26342c'
    context.font = '700 11px ui-monospace, SFMono-Regular, Consolas, monospace'
    context.fillText(color.code, x + 27, y + 9)
    context.fillStyle = '#77827c'
    context.font = '10px system-ui, sans-serif'
    context.fillText(`${count} 颗`, x + 27, y + 20)
  })

  context.fillStyle = '#68736d'
  context.font = '12px system-ui, sans-serif'
  context.fillText('由拼豆图纸设计器生成 · 屏幕颜色仅供参考', 16, canvas.height - 16)

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${title || '未命名图纸'}.png`)
  }, 'image/png')
}
