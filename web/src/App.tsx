import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Brush,
  Check,
  ChevronDown,
  CircleDot,
  Columns3,
  Crosshair,
  Download,
  Eraser,
  ExternalLink,
  FolderOpen,
  Grid2X2,
  Hash,
  House,
  ImagePlus,
  Link,
  LoaderCircle,
  Lock,
  PaintBucket,
  Palette as PaletteIcon,
  Pipette,
  Redo2,
  Replace,
  Save,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  Unlock,
  Upload,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import './App.css'
import { LandingPage } from './LandingPage'
import { GridCanvas } from './components/GridCanvas'
import { ComparisonDialog } from './components/ComparisonDialog'
import { CREATOR_AVATAR_URL, CREATOR_HOME_URL, CREATOR_NAME } from './config/creator'
import {
  DEFAULT_PALETTE_ID,
  colorIndexByCode,
  defaultPalette,
  paletteById,
  paletteCatalog,
} from './data/palette'
import { connectSubjectRegions, nearestColorIndex, quantizeImage, remapGridPalette } from './lib/imageProcessing'
import { floodFillGrid, replaceGridColor } from './lib/gridEditing'
import { loadLocalWorkspace, saveLocalWorkspace } from './lib/localWorkspace'
import {
  analyzePatternHealth,
  fillPatternHoles,
  removePatternCells,
  type PatternHealthIssue,
  type PatternHealthIssueKind,
} from './lib/patternHealth'
import {
  DETAIL_PRESETS,
  detailPresetForDimensions,
  dimensionsForDetail,
  type DetailPreset,
} from './lib/gridDetail'
import { exportPatternPng, readProject, saveProject } from './lib/project'
import { extractMainSubject } from './lib/subjectExtraction'
import type { BeadView, EditorTool, GridData } from './types'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const defaultPaletteIndex = (code: string) => colorIndexByCode.get(code) ?? 0

function createStarterGrid(): GridData {
  const width = 32
  const height = 32
  const cells = new Array<number>(width * height).fill(-1)
  const set = (x: number, y: number, color: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) cells[y * width + x] = color
  }
  const circle = (centerX: number, centerY: number, radius: number, color: number) => {
    for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
      for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) set(x, y, color)
      }
    }
  }

  const petalLight = defaultPaletteIndex('E12')
  const petalDark = defaultPaletteIndex('F12')
  const center = defaultPaletteIndex('A26')
  const centerShade = defaultPaletteIndex('G6')
  const stem = defaultPaletteIndex('B8')
  const leaf = defaultPaletteIndex('B19')

  circle(16, 7, 4.6, petalLight)
  circle(22, 11, 4.6, petalDark)
  circle(20, 17, 4.6, petalLight)
  circle(12, 17, 4.6, petalDark)
  circle(10, 11, 4.6, petalLight)
  circle(16, 12, 4.4, center)
  circle(17, 13, 2.2, centerShade)
  for (let y = 18; y < 30; y += 1) {
    set(15, y, stem)
    set(16, y, stem)
  }
  for (let offset = 0; offset < 5; offset += 1) {
    set(14 - offset, 22 + offset, leaf)
    set(13 - offset, 22 + offset, leaf)
    set(17 + offset, 25 - offset, leaf)
    set(18 + offset, 25 - offset, leaf)
  }
  return { width, height, cells }
}

const readImageFile = (file: File) => new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.onload = () => {
    const image = new Image()
    image.onload = () => resolve({ image, url: String(reader.result) })
    image.onerror = () => reject(new Error('无法识别这张图片'))
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
})

const readStoredImage = (blob: Blob) => new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => resolve({ image, url })
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('无法恢复上次上传的图片'))
  }
  image.src = url
})

type EditorAppProps = {
  onHome: () => void
}

type EditorSnapshot = {
  grid: GridData
  bridgeBaseGrid: GridData
  paletteId: string
  bridgeEnabled: boolean
  bridgeColorIndex: number
}

function EditorApp({ onHome }: EditorAppProps) {
  const [title, setTitle] = useState('春日小花')
  const [grid, setGrid] = useState<GridData>(() => createStarterGrid())
  const [bridgeBaseGrid, setBridgeBaseGrid] = useState<GridData>(() => createStarterGrid())
  const [activePaletteId, setActivePaletteId] = useState(DEFAULT_PALETTE_ID)
  const activePalette = paletteById.get(activePaletteId) ?? defaultPalette
  const palette = activePalette.colors
  const paletteGroups = activePalette.groups
  const [history, setHistory] = useState<EditorSnapshot[]>([])
  const [future, setFuture] = useState<EditorSnapshot[]>([])
  const [tool, setTool] = useState<EditorTool>('paint')
  const [selectedColor, setSelectedColor] = useState(() => defaultPaletteIndex('F12'))
  const [view, setView] = useState<BeadView>('pattern')
  const [zoom, setZoom] = useState(100)
  const [targetWidth, setTargetWidth] = useState(32)
  const [targetHeight, setTargetHeight] = useState(32)
  const [detailPreset, setDetailPreset] = useState<DetailPreset>('standard')
  const [ratioLocked, setRatioLocked] = useState(true)
  const [maxColors, setMaxColors] = useState(24)
  const [subjectEnabled, setSubjectEnabled] = useState(false)
  const [subjectBridgeEnabled, setSubjectBridgeEnabled] = useState(true)
  const [subjectBridgeColor, setSubjectBridgeColor] = useState(() => defaultPaletteIndex('H10'))
  const [bridgePaletteOpen, setBridgePaletteOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [subjectProgress, setSubjectProgress] = useState(0)
  const [processingLabel, setProcessingLabel] = useState('正在匹配色号')
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null)
  const [subjectCache, setSubjectCache] = useState<{
    sourceUrl: string
    image: HTMLImageElement
    previewUrl: string
  } | null>(null)
  const [sourceName, setSourceName] = useState('示例图案')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'palette' | 'usage' | 'health'>('palette')
  const [selectedHealthIssue, setSelectedHealthIssue] = useState<PatternHealthIssueKind | null>(null)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('ALL')
  const [toast, setToast] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const canvasScrollerRef = useRef<HTMLDivElement>(null)
  const bridgePickerRef = useRef<HTMLDivElement>(null)

  const notify = useCallback((message: string) => setToast(message), [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!bridgePaletteOpen) return
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!bridgePickerRef.current?.contains(event.target as Node)) setBridgePaletteOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBridgePaletteOpen(false)
    }
    const frame = window.requestAnimationFrame(() => {
      bridgePickerRef.current
        ?.querySelector<HTMLElement>(`[data-color-index="${subjectBridgeColor}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    })
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [bridgePaletteOpen, subjectBridgeColor])

  useEffect(() => () => {
    if (subjectCache?.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(subjectCache.previewUrl)
    }
  }, [subjectCache])

  useEffect(() => () => {
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])

  useEffect(() => {
    let cancelled = false

    const restoreWorkspace = async () => {
      try {
        const saved = await loadLocalWorkspace()
        if (!saved || cancelled) return
        const savedPalette = paletteById.get(saved.paletteId)
        if (!savedPalette || saved.grid.cells.some((cell) => cell < -1 || cell >= savedPalette.colors.length)) {
          throw new Error('上次工作区使用了无效的色库数据')
        }

        const restoredImage = saved.sourceBlob ? await readStoredImage(saved.sourceBlob) : null
        if (cancelled) {
          if (restoredImage?.url.startsWith('blob:')) URL.revokeObjectURL(restoredImage.url)
          return
        }

        setTitle(saved.title)
        setGrid(saved.grid)
        setBridgeBaseGrid(saved.bridgeBaseGrid ?? saved.grid)
        setActivePaletteId(saved.paletteId)
        setHistory([])
        setFuture([])
        setTargetWidth(saved.targetWidth)
        setTargetHeight(saved.targetHeight)
        setDetailPreset(saved.detailPreset)
        setRatioLocked(saved.ratioLocked)
        setMaxColors(saved.maxColors)
        setSubjectEnabled(saved.subjectEnabled)
        setSubjectBridgeEnabled(saved.subjectBridgeEnabled)
        setSubjectBridgeColor(Math.min(saved.subjectBridgeColor, savedPalette.colors.length - 1))
        setSelectedColor(Math.min(saved.selectedColor, savedPalette.colors.length - 1))
        setView(saved.view)
        setZoom(saved.zoom)
        setSourceName(saved.sourceName)
        setSourceBlob(saved.sourceBlob)
        setSourceImage(restoredImage?.image ?? null)
        setSourceUrl(restoredImage?.url ?? '')
        notify('已恢复上次编辑内容')
      } catch (error) {
        setStorageStatus('error')
        notify(error instanceof Error ? error.message : '无法恢复本地工作区')
      } finally {
        if (!cancelled) {
          setStorageReady(true)
          setStorageStatus((status) => status === 'error' ? status : 'saved')
        }
      }
    }

    void restoreWorkspace()
    return () => { cancelled = true }
  }, [notify])

  useEffect(() => {
    if (!storageReady) return
    const timeout = window.setTimeout(() => {
      setStorageStatus('saving')
      void saveLocalWorkspace({
        schema: 'pindou-local-workspace',
        version: 1,
        savedAt: new Date().toISOString(),
        title,
        paletteId: activePaletteId,
        grid,
        bridgeBaseGrid,
        sourceName,
        sourceBlob,
        targetWidth,
        targetHeight,
        detailPreset,
        ratioLocked,
        maxColors,
        subjectEnabled,
        subjectBridgeEnabled,
        subjectBridgeColor,
        selectedColor,
        view,
        zoom,
      }).then(() => setStorageStatus('saved')).catch(() => setStorageStatus('error'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [activePaletteId, bridgeBaseGrid, detailPreset, grid, maxColors, ratioLocked, selectedColor, sourceBlob, sourceName, storageReady, subjectBridgeColor, subjectBridgeEnabled, subjectEnabled, targetHeight, targetWidth, title, view, zoom])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const previous = history[history.length - 1]
    setHistory((items) => items.slice(0, -1))
    setFuture((items) => [{
      grid,
      bridgeBaseGrid,
      paletteId: activePaletteId,
      bridgeEnabled: subjectBridgeEnabled,
      bridgeColorIndex: subjectBridgeColor,
    }, ...items].slice(0, 30))
    setGrid(previous.grid)
    setBridgeBaseGrid(previous.bridgeBaseGrid)
    if (previous.paletteId !== activePaletteId) {
      setSelectedColor(0)
    }
    setActivePaletteId(previous.paletteId)
    setSubjectBridgeEnabled(previous.bridgeEnabled)
    setSubjectBridgeColor(previous.bridgeColorIndex)
    setGroup('ALL')
    setTargetWidth(previous.grid.width)
    setTargetHeight(previous.grid.height)
    setDetailPreset(detailPresetForDimensions(previous.grid.width, previous.grid.height))
  }, [activePaletteId, bridgeBaseGrid, grid, history, subjectBridgeColor, subjectBridgeEnabled])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setFuture((items) => items.slice(1))
    setHistory((items) => [...items, {
      grid,
      bridgeBaseGrid,
      paletteId: activePaletteId,
      bridgeEnabled: subjectBridgeEnabled,
      bridgeColorIndex: subjectBridgeColor,
    }].slice(-30))
    setGrid(next.grid)
    setBridgeBaseGrid(next.bridgeBaseGrid)
    if (next.paletteId !== activePaletteId) {
      setSelectedColor(0)
    }
    setActivePaletteId(next.paletteId)
    setSubjectBridgeEnabled(next.bridgeEnabled)
    setSubjectBridgeColor(next.bridgeColorIndex)
    setGroup('ALL')
    setTargetWidth(next.grid.width)
    setTargetHeight(next.grid.height)
    setDetailPreset(detailPresetForDimensions(next.grid.width, next.grid.height))
  }, [activePaletteId, bridgeBaseGrid, future, grid, subjectBridgeColor, subjectBridgeEnabled])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [redo, undo])

  useEffect(() => {
    if (view !== 'pattern') return
    const frame = window.requestAnimationFrame(() => {
      canvasScrollerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view])

  const usage = useMemo(() => {
    const counts = new Map<number, number>()
    grid.cells.forEach((color) => {
      if (color >= 0) counts.set(color, (counts.get(color) ?? 0) + 1)
    })
    return [...counts.entries()].sort((left, right) => right[1] - left[1])
  }, [grid])

  const beadCount = useMemo(() => grid.cells.filter((cell) => cell >= 0).length, [grid])
  const healthReport = useMemo(() => analyzePatternHealth(grid), [grid])
  const highlightedHealthCells = useMemo(() => (
    activeTab === 'health'
      ? healthReport.issues.find((issue) => issue.id === selectedHealthIssue)?.cells ?? []
      : []
  ), [activeTab, healthReport, selectedHealthIssue])
  const filteredPalette = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase()
    const colors = paletteById.get(activePaletteId)?.colors ?? defaultPalette.colors
    return colors
      .map((color, index) => ({ color, index }))
      .filter(({ color }) => group === 'ALL' || color.group === group)
      .filter(({ color }) => !normalizedSearch || color.code.includes(normalizedSearch) || color.hex.includes(normalizedSearch))
  }, [activePaletteId, group, search])

  const replaceGrid = useCallback((next: GridData, nextBridgeBase = bridgeBaseGrid) => {
    setHistory((items) => [...items, {
      grid,
      bridgeBaseGrid,
      paletteId: activePaletteId,
      bridgeEnabled: subjectBridgeEnabled,
      bridgeColorIndex: subjectBridgeColor,
    }].slice(-30))
    setFuture([])
    setGrid(next)
    setBridgeBaseGrid(nextBridgeBase)
  }, [activePaletteId, bridgeBaseGrid, grid, subjectBridgeColor, subjectBridgeEnabled])

  const getImageForConversion = useCallback(async (
    image: HTMLImageElement,
    imageUrl: string,
  ) => {
    if (!subjectEnabled) return image
    if (subjectCache?.sourceUrl === imageUrl) return subjectCache.image

    const extracted = await extractMainSubject(imageUrl, ({ stage, progress }) => {
      setSubjectProgress(progress)
      setProcessingLabel(stage === 'loading'
        ? `正在加载主体模型 ${progress}%`
        : '正在提取主要形象')
    })
    setSubjectCache({ sourceUrl: imageUrl, image: extracted.image, previewUrl: extracted.url })
    return extracted.image
  }, [subjectCache, subjectEnabled])

  const createGridFromImage = useCallback((image: HTMLImageElement, width: number, height: number) => {
    const colors = paletteById.get(activePaletteId)?.colors ?? defaultPalette.colors
    const base = quantizeImage(image, width, height, maxColors, colors)
    return {
      base,
      result: subjectEnabled && subjectBridgeEnabled
        ? connectSubjectRegions(base, subjectBridgeColor)
        : base,
    }
  }, [activePaletteId, maxColors, subjectBridgeColor, subjectBridgeEnabled, subjectEnabled])

  const runConversion = useCallback(async (
    image = sourceImage,
    width = targetWidth,
    height = targetHeight,
  ) => {
    if (!image) {
      notify('请先选择一张图片')
      return
    }
    setProcessing(true)
    setSubjectProgress(0)
    await new Promise((resolve) => window.setTimeout(resolve, 20))
    try {
      const conversionImage = await getImageForConversion(image, sourceUrl)
      const preset = DETAIL_PRESETS.find((item) => item.id === detailPreset)
      const dimensions = preset
        ? dimensionsForDetail(conversionImage.naturalWidth, conversionImage.naturalHeight, preset.longestSide)
        : {
            width,
            height: ratioLocked && subjectEnabled
              ? clamp(Math.round(width * conversionImage.naturalHeight / conversionImage.naturalWidth), 8, 160)
              : height,
          }
      setProcessingLabel('正在匹配色号')
      setTargetWidth(dimensions.width)
      setTargetHeight(dimensions.height)
      const next = createGridFromImage(conversionImage, dimensions.width, dimensions.height)
      replaceGrid(next.result, next.base)
      notify(subjectEnabled ? '主体已提取并生成图纸' : `已生成 ${dimensions.width} × ${dimensions.height} 图纸`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '图片转换失败')
    } finally {
      setProcessing(false)
    }
  }, [createGridFromImage, detailPreset, getImageForConversion, notify, ratioLocked, replaceGrid, sourceImage, sourceUrl, subjectEnabled, targetHeight, targetWidth])

  const handleImageFile = useCallback(async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('请选择 PNG、JPG 或 WebP 图片')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      notify('图片不能超过 20 MB')
      return
    }

    setProcessing(true)
    setSubjectProgress(0)
    setProcessingLabel('正在读取图片')
    try {
      const { image, url } = await readImageFile(file)
      setSubjectCache(null)
      setSourceImage(image)
      setSourceUrl(url)
      setSourceBlob(file)
      setSourceName(file.name)
      setTitle(file.name.replace(/\.[^.]+$/, ''))
      const conversionImage = await getImageForConversion(image, url)
      const preset = DETAIL_PRESETS.find((item) => item.id === detailPreset)
      const dimensions = preset
        ? dimensionsForDetail(conversionImage.naturalWidth, conversionImage.naturalHeight, preset.longestSide)
        : {
            width: targetWidth,
            height: ratioLocked
              ? clamp(Math.round(targetWidth * conversionImage.naturalHeight / conversionImage.naturalWidth), 8, 160)
              : targetHeight,
          }
      setTargetWidth(dimensions.width)
      setTargetHeight(dimensions.height)
      await new Promise((resolve) => window.setTimeout(resolve, 20))
      setProcessingLabel('正在匹配色号')
      const next = createGridFromImage(conversionImage, dimensions.width, dimensions.height)
      replaceGrid(next.result, next.base)
      notify(subjectEnabled ? '主体已提取，点击画布可以继续修图' : '图片已转换，点击画布可以继续修图')
    } catch (error) {
      notify(error instanceof Error ? error.message : '图片读取失败')
    } finally {
      setProcessing(false)
    }
  }, [createGridFromImage, detailPreset, getImageForConversion, notify, ratioLocked, replaceGrid, subjectEnabled, targetHeight, targetWidth])

  const handleCellAction = useCallback((index: number, isGestureStart: boolean) => {
    const currentColor = grid.cells[index]
    if (tool === 'pick') {
      if (currentColor >= 0) {
        setSelectedColor(currentColor)
        setTool('paint')
      }
      return
    }

    if (tool === 'fill') {
      if (!isGestureStart) return
      const result = floodFillGrid(grid, index, selectedColor)
      if (result.changed === 0) return
      replaceGrid(result.grid, result.grid)
      notify(`已填充 ${result.changed} 颗拼豆`)
      return
    }

    if (tool === 'replace') {
      if (!isGestureStart) return
      if (currentColor < 0) {
        notify('全局换色需要点击一个已有颜色')
        return
      }
      const result = replaceGridColor(grid, currentColor, selectedColor)
      if (result.changed === 0) return
      replaceGrid(result.grid, result.grid)
      notify(`已替换 ${result.changed} 颗拼豆`)
      return
    }

    const nextColor = tool === 'erase' ? -1 : selectedColor
    if (currentColor === nextColor) return
    if (isGestureStart) {
      setHistory((items) => [...items, {
        grid,
        bridgeBaseGrid,
        paletteId: activePaletteId,
        bridgeEnabled: subjectBridgeEnabled,
        bridgeColorIndex: subjectBridgeColor,
      }].slice(-30))
      setFuture([])
    }
    setGrid((current) => {
      if (current.cells[index] === nextColor) return current
      const cells = [...current.cells]
      cells[index] = nextColor
      return { ...current, cells }
    })
    setBridgeBaseGrid((current) => {
      if (current.cells[index] === nextColor) return current
      const cells = [...current.cells]
      cells[index] = nextColor
      return { ...current, cells }
    })
  }, [activePaletteId, bridgeBaseGrid, grid, notify, replaceGrid, selectedColor, subjectBridgeColor, subjectBridgeEnabled, tool])

  const handleWidthChange = (value: number) => {
    const nextWidth = clamp(value || 8, 8, 160)
    setDetailPreset('custom')
    setTargetWidth(nextWidth)
    if (ratioLocked) {
      const ratio = sourceImage
        ? sourceImage.naturalHeight / sourceImage.naturalWidth
        : targetHeight / targetWidth
      setTargetHeight(clamp(Math.round(nextWidth * ratio), 8, 160))
    }
  }

  const handleHeightChange = (value: number) => {
    const nextHeight = clamp(value || 8, 8, 160)
    setDetailPreset('custom')
    setTargetHeight(nextHeight)
    if (ratioLocked) {
      const ratio = sourceImage
        ? sourceImage.naturalWidth / sourceImage.naturalHeight
        : targetWidth / targetHeight
      setTargetWidth(clamp(Math.round(nextHeight * ratio), 8, 160))
    }
  }

  const handleDetailPresetChange = (nextPreset: Exclude<DetailPreset, 'custom'>) => {
    const preset = DETAIL_PRESETS.find((item) => item.id === nextPreset)
    if (!preset) return
    const detailImage = subjectEnabled && subjectCache?.sourceUrl === sourceUrl
      ? subjectCache.image
      : sourceImage
    const sourceWidth = detailImage?.naturalWidth ?? targetWidth
    const sourceHeight = detailImage?.naturalHeight ?? targetHeight
    const dimensions = dimensionsForDetail(sourceWidth, sourceHeight, preset.longestSide)
    setDetailPreset(nextPreset)
    setTargetWidth(dimensions.width)
    setTargetHeight(dimensions.height)
  }

  const handleBridgeEnabledChange = (enabled: boolean) => {
    setSubjectBridgeEnabled(enabled)
    setBridgePaletteOpen(false)
    if (!subjectEnabled) return
    replaceGrid(
      enabled ? connectSubjectRegions(bridgeBaseGrid, subjectBridgeColor) : bridgeBaseGrid,
      bridgeBaseGrid,
    )
  }

  const handleBridgeColorChange = (colorIndex: number) => {
    setSubjectBridgeColor(colorIndex)
    setBridgePaletteOpen(false)
    if (subjectEnabled && subjectBridgeEnabled) {
      replaceGrid(connectSubjectRegions(bridgeBaseGrid, colorIndex), bridgeBaseGrid)
    }
  }

  const focusHealthIssue = (issue: PatternHealthIssue) => {
    setSelectedHealthIssue(issue.id)
    window.requestAnimationFrame(() => {
      const scroller = canvasScrollerRef.current
      const canvas = scroller?.querySelector<HTMLCanvasElement>('.pattern-canvas')
      const first = issue.cells[0]
      if (!scroller || !canvas || first === undefined) return
      const x = first % grid.width
      const y = Math.floor(first / grid.width)
      scroller.scrollTo({
        left: Math.max(0, canvas.offsetLeft + canvas.clientWidth * (x + 0.5) / grid.width - scroller.clientWidth / 2),
        top: Math.max(0, canvas.offsetTop + canvas.clientHeight * (y + 0.5) / grid.height - scroller.clientHeight / 2),
        behavior: 'smooth',
      })
    })
  }

  const repairHealthIssue = (issue: PatternHealthIssue) => {
    let next = grid
    if (issue.kind === 'isolated') next = removePatternCells(grid, issue.cells)
    if (issue.kind === 'hole') next = fillPatternHoles(grid, issue.cells)
    if (issue.kind === 'disconnected') next = connectSubjectRegions(grid, subjectBridgeColor)
    if (next === grid) return

    replaceGrid(next, issue.kind === 'disconnected' ? grid : next)
    setSelectedHealthIssue(null)
    const messages: Record<Exclude<PatternHealthIssueKind, 'fragile' | 'empty'>, string> = {
      isolated: '已移除孤立豆',
      disconnected: `已使用 ${palette[subjectBridgeColor].code} 连接分离区域`,
      hole: '已填补单格空洞',
    }
    if (issue.kind !== 'fragile' && issue.kind !== 'empty') notify(messages[issue.kind])
  }

  const handlePaletteChange = (nextPaletteId: string) => {
    if (nextPaletteId === activePaletteId) return
    const nextPalette = paletteById.get(nextPaletteId)
    if (!nextPalette) return

    const selectedRgb = palette[selectedColor]?.rgb
    const bridgeRgb = palette[subjectBridgeColor]?.rgb
    const nextBridgeBase = remapGridPalette(bridgeBaseGrid, palette, nextPalette.colors)
    replaceGrid(remapGridPalette(grid, palette, nextPalette.colors), nextBridgeBase)
    setActivePaletteId(nextPalette.id)
    setSelectedColor(selectedRgb ? nearestColorIndex(selectedRgb, nextPalette.colors) : 0)
    setSubjectBridgeColor(bridgeRgb ? nearestColorIndex(bridgeRgb, nextPalette.colors) : 0)
    setGroup('ALL')
    setSearch('')
    notify(`已切换为 ${nextPalette.title}，当前图案已重新配色`)
  }

  const handleProjectOpen = async (file?: File) => {
    if (!file) return
    try {
      const project = await readProject(file)
      const projectPalette = paletteById.get(project.paletteId)
      if (!projectPalette) throw new Error('工程使用了当前版本不支持的色库')
      if (project.cells.some((cell) => cell < -1 || cell >= projectPalette.colors.length)) {
        throw new Error('工程中的色号数据超出色库范围')
      }
      const projectGrid = { width: project.width, height: project.height, cells: project.cells }
      replaceGrid(projectGrid, projectGrid)
      setActivePaletteId(projectPalette.id)
      setSelectedColor(0)
      setSubjectBridgeColor(0)
      setGroup('ALL')
      setSearch('')
      setTitle(project.title)
      setTargetWidth(project.width)
      setTargetHeight(project.height)
      setDetailPreset(detailPresetForDimensions(project.width, project.height))
      setSourceImage(null)
      setSourceUrl('')
      setSourceBlob(null)
      setSubjectCache(null)
      setSourceName('工程文件')
      notify('工程已打开')
    } catch (error) {
      notify(error instanceof Error ? error.message : '工程文件读取失败')
    }
  }

  const toolButtons: Array<{ id: EditorTool; label: string; title: string; icon: typeof Brush }> = [
    { id: 'paint', label: '画笔', title: '逐格绘制', icon: Brush },
    { id: 'fill', label: '填充', title: '填充连续同色区域', icon: PaintBucket },
    { id: 'replace', label: '换色', title: '将点击色全部替换为当前颜色', icon: Replace },
    { id: 'pick', label: '吸色', title: '从图纸吸取颜色', icon: Pipette },
    { id: 'erase', label: '橡皮', title: '擦除拼豆', icon: Eraser },
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={onHome} title="返回首页" aria-label="返回豆图首页">
          <span className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="brand-name">豆图</span>
          <House className="brand-home" size={14} aria-hidden="true" />
        </button>

        <a className="creator-home-link" href={CREATOR_HOME_URL} target="_blank" rel="noreferrer" title="访问 MooeRooster 个人主页">
          <img src={CREATOR_AVATAR_URL} alt="" />
          <span>{CREATOR_NAME}</span>
          <ExternalLink size={12} />
        </a>

        <div className="project-name-wrap">
          <input
            className="project-name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="图纸名称"
            maxLength={40}
          />
          <span className={`save-state ${storageStatus}`}>
            {storageStatus === 'error'
              ? <AlertCircle size={13} />
              : storageStatus === 'saved'
                ? <Check size={13} />
                : <LoaderCircle className="save-spinner" size={13} />}
            {storageStatus === 'loading'
              ? '正在恢复本地内容'
              : storageStatus === 'saving'
                ? '正在自动保存'
                : storageStatus === 'saved'
                  ? '已自动保存到本机'
                  : '本地自动保存不可用'}
          </span>
        </div>

        <div className="top-actions">
          <button className="icon-button" onClick={undo} disabled={!history.length} title="撤销" aria-label="撤销">
            <Undo2 size={18} />
          </button>
          <button className="icon-button" onClick={redo} disabled={!future.length} title="重做" aria-label="重做">
            <Redo2 size={18} />
          </button>
          <span className="action-divider" />
          <button className="icon-button" onClick={() => projectInputRef.current?.click()} title="打开工程" aria-label="打开工程">
            <FolderOpen size={18} />
          </button>
          <button className="icon-button" onClick={() => { saveProject(title, grid, activePaletteId); notify('工程文件已保存') }} title="保存工程" aria-label="保存工程">
            <Save size={18} />
          </button>
          <button className="primary-button" onClick={() => exportPatternPng(title, grid, palette, activePalette.title)}>
            <Download size={17} /> 导出图纸
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <nav className="tool-rail" aria-label="编辑工具">
          {toolButtons.map(({ id, label, title: toolTitle, icon: Icon }) => (
            <button
              key={id}
              className={`tool-button ${tool === id ? 'active' : ''}`}
              onClick={() => setTool(id)}
              title={toolTitle}
              aria-label={label}
              aria-pressed={tool === id}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
          <div className="tool-rail-spacer" />
          <div className="selected-bead" title={`当前颜色 ${palette[selectedColor].code}`}>
            <span style={{ background: palette[selectedColor].hex }} />
            <small>{palette[selectedColor].code}</small>
          </div>
        </nav>

        <main className="editor-main">
          <section className="conversion-bar" aria-label="图片转换设置">
            <button className="upload-button" onClick={() => imageInputRef.current?.click()} aria-label="选择图片">
              <ImagePlus size={18} />
              <span>
                <strong>选择图片</strong>
                <small>PNG · JPG · WebP</small>
              </span>
            </button>

            <label className={`subject-toggle ${subjectEnabled ? 'active' : ''}`} title="在浏览器中识别并保留主要人物或物品">
              <input
                type="checkbox"
                checked={subjectEnabled}
                onChange={(event) => {
                  setSubjectEnabled(event.target.checked)
                  setSubjectProgress(0)
                }}
              />
              <span className="toggle-track"><i /></span>
              <span className="toggle-copy">
                <strong><ScanSearch size={14} /> 提取主体</strong>
                <small>{subjectEnabled ? '人物与物品' : '首次约 70 MB'}</small>
              </span>
            </label>

            <div className="dimension-control">
              <label>
                <span>宽</span>
                <input type="number" min="8" max="160" value={targetWidth} onChange={(event) => handleWidthChange(Number(event.target.value))} />
              </label>
              <button className="link-button" onClick={() => setRatioLocked((locked) => !locked)} title={ratioLocked ? '解除宽高比例' : '锁定宽高比例'} aria-label={ratioLocked ? '解除宽高比例' : '锁定宽高比例'}>
                {ratioLocked ? <Lock size={15} /> : <Unlock size={15} />}
              </button>
              <label>
                <span>高</span>
                <input type="number" min="8" max="160" value={targetHeight} onChange={(event) => handleHeightChange(Number(event.target.value))} />
              </label>
            </div>

            <div className="detail-control">
              <span className="detail-label">精细度</span>
              <div className="detail-options" role="radiogroup" aria-label="图纸精细度">
                {DETAIL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={detailPreset === preset.id}
                    className={detailPreset === preset.id ? 'active' : ''}
                    onClick={() => handleDetailPresetChange(preset.id)}
                    title={`${preset.label}，长边 ${preset.longestSide} 格`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <small>{detailPreset === 'custom' ? '自定义尺寸' : `长边 ${Math.max(targetWidth, targetHeight)} 格`}</small>
            </div>

            <label className="color-limit-control" title="限制自动配色使用的颜色数量">
              <span><strong>{maxColors} 色</strong><small>颜色上限</small></span>
              <input aria-label="颜色上限" type="range" min="4" max="64" step="1" value={maxColors} onChange={(event) => setMaxColors(Number(event.target.value))} />
            </label>

            <button className="convert-button" onClick={() => runConversion()} disabled={!sourceImage || processing}>
              <Sparkles size={17} />
              {processing ? '正在生成' : '重新生成'}
            </button>
          </section>

          <section
            className={`workspace ${processing ? 'processing' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void handleImageFile(event.dataTransfer.files[0])
            }}
          >
            <div className={`workspace-toolbar ${subjectEnabled ? 'has-bridge' : ''}`}>
              <div className="segmented-control" aria-label="画布显示方式">
                <button className={view === 'square' ? 'active' : ''} onClick={() => setView('square')} title="方格视图" aria-label="方格视图">
                  <Grid2X2 size={16} />
                </button>
                <button className={view === 'bead' ? 'active' : ''} onClick={() => setView('bead')} title="拼豆视图" aria-label="拼豆视图">
                  <CircleDot size={16} />
                </button>
                <button className={view === 'pattern' ? 'active' : ''} onClick={() => setView('pattern')} title="图纸视图" aria-label="图纸视图">
                  <Hash size={16} />
                </button>
              </div>
              <div className="zoom-control">
                <button onClick={() => setZoom((value) => clamp(value - 20, 40, 220))} title="缩小" aria-label="缩小"><ZoomOut size={16} /></button>
                <span>{zoom}%</span>
                <button onClick={() => setZoom((value) => clamp(value + 20, 40, 220))} title="放大" aria-label="放大"><ZoomIn size={16} /></button>
              </div>
              {view === 'pattern' && (
                <span className="pattern-mode-note"><Hash size={13} /> <strong>3 × 3</strong><small>坐标与色号</small></span>
              )}
              {subjectEnabled && (
                <div className={`bridge-control ${subjectBridgeEnabled ? 'active' : ''}`}>
                  <label title="用背景色连接主体中面积较大的分离色块">
                    <input
                      type="checkbox"
                      checked={subjectBridgeEnabled}
                      onChange={(event) => handleBridgeEnabledChange(event.target.checked)}
                    />
                    <span className="toggle-track"><i /></span>
                    <span className="toggle-copy">
                      <strong><PaintBucket size={14} /> 主体衔接</strong>
                      <small>{subjectBridgeEnabled ? '填充分离区域' : '保留透明空隙'}</small>
                    </span>
                  </label>
                  <div className="bridge-picker" ref={bridgePickerRef}>
                    <button
                      type="button"
                      className="bridge-color"
                      disabled={!subjectBridgeEnabled}
                      aria-label="主体衔接色"
                      aria-haspopup="listbox"
                      aria-expanded={bridgePaletteOpen}
                      title={`衔接色 ${palette[subjectBridgeColor].code}`}
                      onClick={() => setBridgePaletteOpen((open) => !open)}
                    >
                      <i style={{ background: palette[subjectBridgeColor].hex }} />
                      <strong>{palette[subjectBridgeColor].code}</strong>
                      <ChevronDown size={13} />
                    </button>
                    {bridgePaletteOpen && subjectBridgeEnabled && (
                      <div className="bridge-palette-menu" role="listbox" aria-label="选择主体衔接颜色">
                        {palette.map((color, index) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={subjectBridgeColor === index}
                            data-color-index={index}
                            key={color.code}
                            title={`${color.code} · ${color.hex}`}
                            onClick={() => handleBridgeColorChange(index)}
                          >
                            <i style={{ background: color.hex }} />
                            <span>{color.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="source-status">
                {sourceUrl ? (
                  <img
                    src={subjectEnabled && subjectCache?.sourceUrl === sourceUrl ? subjectCache.previewUrl : sourceUrl}
                    alt={subjectEnabled && subjectCache?.sourceUrl === sourceUrl ? '提取后的主体缩略图' : '原图缩略图'}
                  />
                ) : <Upload size={15} />}
                <span>{subjectEnabled && subjectCache?.sourceUrl === sourceUrl ? `已提取 · ${sourceName}` : sourceName}</span>
                <ShieldCheck size={14} aria-label="本机处理" />
              </div>
              <button
                type="button"
                className="compare-button"
                disabled={!sourceUrl}
                onClick={() => setComparisonOpen(true)}
                title="对照原图、主体与图纸"
              >
                <Columns3 size={15} /> <span>前后对照</span>
              </button>
            </div>

            <div className="canvas-scroller" ref={canvasScrollerRef}>
              <div className="canvas-stage">
                <GridCanvas
                  grid={grid}
                  palette={palette}
                  view={view}
                  zoom={zoom}
                  highlightedCells={highlightedHealthCells}
                  onCellAction={handleCellAction}
                />
              </div>
            </div>

            {processing && (
              <div className="processing-overlay" role="status">
                <span className="spinner" />
                <strong>{processingLabel}</strong>
                {processingLabel.startsWith('正在加载主体模型') && (
                  <span className="model-progress"><i style={{ width: `${subjectProgress}%` }} /></span>
                )}
              </div>
            )}
          </section>

          <footer className="statusbar">
            <span>{grid.width} × {grid.height} 颗</span>
            <span>{beadCount.toLocaleString('zh-CN')} 颗拼豆</span>
            <span>{usage.length} 种颜色</span>
            <span className="statusbar-spacer" />
            <span className="local-status"><ShieldCheck size={14} /> 图片仅在当前浏览器处理</span>
          </footer>
        </main>

        <aside className="inspector">
          <div className="inspector-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'palette'} className={activeTab === 'palette' ? 'active' : ''} onClick={() => setActiveTab('palette')}>
              <PaletteIcon size={17} /> 色板
            </button>
            <button role="tab" aria-selected={activeTab === 'usage'} className={activeTab === 'usage' ? 'active' : ''} onClick={() => setActiveTab('usage')}>
              <BarChart3 size={17} /> 用量 <span>{usage.length}</span>
            </button>
            <button role="tab" aria-selected={activeTab === 'health'} className={activeTab === 'health' ? 'active' : ''} onClick={() => setActiveTab('health')}>
              <ShieldAlert size={17} /> 体检 <span>{healthReport.issues.length}</span>
            </button>
          </div>

          {activeTab === 'palette' ? (
            <div className="palette-panel">
              <div className="palette-heading">
                <div className="palette-heading-copy">
                  <select value={activePaletteId} onChange={(event) => handlePaletteChange(event.target.value)} aria-label="拼豆色库">
                    {paletteCatalog.map((item) => (
                      <option value={item.id} key={item.id}>{item.title} · {item.colors.length} 色</option>
                    ))}
                  </select>
                  <small>{activePalette.description} · 屏幕参考值</small>
                </div>
                <a href={activePalette.sourceUrl} target="_blank" rel="noreferrer" title="查看色库来源" aria-label="查看色库来源"><Link size={15} /></a>
              </div>
              <div className="palette-filters">
                <label className="search-field">
                  <Search size={15} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索色号" />
                </label>
                <select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="色系分组">
                  <option value="ALL">全部</option>
                  {paletteGroups.map((item) => <option value={item} key={item}>{item} 组</option>)}
                </select>
              </div>
              <div className="swatch-grid">
                {filteredPalette.map(({ color, index }) => (
                  <button
                    key={color.code}
                    className={selectedColor === index ? 'selected' : ''}
                    onClick={() => { setSelectedColor(index); setTool('paint') }}
                    title={`${color.code} · ${color.hex}`}
                    aria-label={`选择 ${color.code}`}
                  >
                    <span style={{ background: color.hex }} />
                    <small>{color.code}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : activeTab === 'usage' ? (
            <div className="usage-panel">
              <div className="usage-summary">
                <div><strong>{beadCount.toLocaleString('zh-CN')}</strong><span>总颗数</span></div>
                <div><strong>{usage.length}</strong><span>使用色数</span></div>
              </div>
              <div className="usage-list">
                {usage.map(([index, count]) => {
                  const color = palette[index]
                  return (
                    <button key={color.code} onClick={() => { setSelectedColor(index); setTool('paint'); setActiveTab('palette') }}>
                      <span className="usage-swatch" style={{ background: color.hex }} />
                      <strong>{color.code}</strong>
                      <span className="usage-bar"><i style={{ width: `${Math.max(3, count / beadCount * 100)}%`, background: color.hex }} /></span>
                      <span>{count} 颗</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="health-panel">
              <div className={`health-score ${healthReport.score >= 90 ? 'good' : healthReport.score >= 70 ? 'fair' : 'risk'}`}>
                <div>
                  <strong>{healthReport.score}</strong>
                  <span>/ 100</span>
                </div>
                <p>
                  <strong>{healthReport.score >= 90 ? '结构稳定' : healthReport.score >= 70 ? '建议检查' : '优先修整'}</strong>
                  <span>{healthReport.componentCount} 个连接区域 · {beadCount.toLocaleString('zh-CN')} 颗豆</span>
                </p>
              </div>

              {healthReport.issues.length === 0 ? (
                <div className="health-empty">
                  <ShieldCheck size={28} />
                  <strong>没有发现结构问题</strong>
                  <span>所有拼豆均通过上下左右稳定连接</span>
                </div>
              ) : (
                <div className="health-issues">
                  {healthReport.issues.map((issue) => {
                    const first = issue.cells[0]
                    const coordinate = first === undefined
                      ? ''
                      : `X${first % grid.width + 1} · Y${Math.floor(first / grid.width) + 1}`
                    return (
                      <article className={selectedHealthIssue === issue.id ? 'active' : ''} key={issue.id}>
                        <div className="health-issue-heading">
                          <span className={`health-severity ${issue.kind}`}><AlertCircle size={15} /></span>
                          <div><strong>{issue.title}</strong><small>{coordinate}</small></div>
                          <b>{issue.count}</b>
                        </div>
                        <p>{issue.detail}</p>
                        <div className="health-issue-actions">
                          <button type="button" onClick={() => focusHealthIssue(issue)}><Crosshair size={14} /> 定位</button>
                          {issue.repairLabel && (
                            <button type="button" className="repair" onClick={() => repairHealthIssue(issue)}>
                              <WandSparkles size={14} /> {issue.repairLabel}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleImageFile(event.target.files?.[0]); event.target.value = '' }} />
      <input ref={projectInputRef} hidden type="file" accept=".json,.pindou.json" onChange={(event) => { void handleProjectOpen(event.target.files?.[0]); event.target.value = '' }} />
      {comparisonOpen && sourceUrl && (
        <ComparisonDialog
          sourceName={sourceName}
          originalUrl={sourceUrl}
          subjectUrl={subjectEnabled && subjectCache?.sourceUrl === sourceUrl ? subjectCache.previewUrl : undefined}
          subjectEnabled={subjectEnabled}
          grid={grid}
          palette={palette}
          paletteName={activePalette.title}
          onClose={() => setComparisonOpen(false)}
        />
      )}
      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<'home' | 'editor'>(() => (
    window.location.hash === '#editor' ? 'editor' : 'home'
  ))

  useEffect(() => {
    const syncScreen = () => setScreen(window.location.hash === '#editor' ? 'editor' : 'home')
    window.addEventListener('popstate', syncScreen)
    window.addEventListener('hashchange', syncScreen)
    return () => {
      window.removeEventListener('popstate', syncScreen)
      window.removeEventListener('hashchange', syncScreen)
    }
  }, [])

  const navigate = useCallback((next: 'home' | 'editor') => {
    const nextUrl = next === 'editor'
      ? `${window.location.pathname}${window.location.search}#editor`
      : `${window.location.pathname}${window.location.search}`
    window.history.pushState({}, '', nextUrl)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return screen === 'editor'
    ? <EditorApp onHome={() => navigate('home')} />
    : <LandingPage onStart={() => navigate('editor')} />
}

export default App
