import type { DetailPreset } from './gridDetail'
import type { BeadView, ColorStyle, GridData } from '../types'

const DATABASE_NAME = 'pindou-local'
const STORE_NAME = 'workspace'
const LATEST_WORKSPACE_KEY = 'latest'

export type LocalWorkspace = {
  schema: 'pindou-local-workspace'
  version: 1
  savedAt: string
  title: string
  paletteId: string
  grid: GridData
  bridgeBaseGrid?: GridData | null
  sourceName: string
  sourceBlob: Blob | null
  targetWidth: number
  targetHeight: number
  detailPreset: DetailPreset
  ratioLocked: boolean
  maxColors: number
  colorStyle?: ColorStyle
  subjectEnabled: boolean
  subjectBridgeEnabled: boolean
  subjectBridgeColor: number
  selectedColor: number
  view: BeadView
  zoom: number
}

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('当前浏览器不支持本地工作区存储'))
    return
  }

  const request = window.indexedDB.open(DATABASE_NAME, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME)
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('无法打开本地工作区'))
})

export const isLocalWorkspace = (value: unknown): value is LocalWorkspace => {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Partial<LocalWorkspace>
  const grid = workspace.grid
  if (!grid) return false
  const validDetailPresets: DetailPreset[] = ['draft', 'standard', 'fine', 'ultra', 'custom']
  const validViews: BeadView[] = ['square', 'bead', 'pattern']
  const validColorStyles: ColorStyle[] = [
    'faithful', 'harmonized', 'vivid', 'cartoon', 'pastel', 'retro', 'cool', 'monochrome',
  ]
  const bridgeGrid = workspace.bridgeBaseGrid
  const bridgeGridIsValid = bridgeGrid === undefined
    || bridgeGrid === null
    || (Number.isInteger(bridgeGrid.width)
      && Number.isInteger(bridgeGrid.height)
      && bridgeGrid.width === grid.width
      && bridgeGrid.height === grid.height
      && Array.isArray(bridgeGrid.cells)
      && bridgeGrid.cells.length === bridgeGrid.width * bridgeGrid.height
      && bridgeGrid.cells.every(Number.isInteger))
  return workspace.schema === 'pindou-local-workspace'
    && workspace.version === 1
    && typeof workspace.savedAt === 'string'
    && typeof workspace.title === 'string'
    && typeof workspace.paletteId === 'string'
    && typeof workspace.sourceName === 'string'
    && Number.isInteger(grid.width)
    && Number.isInteger(grid.height)
    && grid.width >= 1
    && grid.height >= 1
    && Array.isArray(grid.cells)
    && grid.cells.length === grid.width * grid.height
    && grid.cells.every(Number.isInteger)
    && bridgeGridIsValid
    && (workspace.sourceBlob === null || workspace.sourceBlob instanceof Blob)
    && Number.isInteger(workspace.targetWidth)
    && Number.isInteger(workspace.targetHeight)
    && validDetailPresets.includes(workspace.detailPreset as DetailPreset)
    && typeof workspace.ratioLocked === 'boolean'
    && Number.isInteger(workspace.maxColors)
    && Number(workspace.maxColors) >= 4
    && Number(workspace.maxColors) <= 64
    && (workspace.colorStyle === undefined || validColorStyles.includes(workspace.colorStyle as ColorStyle))
    && typeof workspace.subjectEnabled === 'boolean'
    && typeof workspace.subjectBridgeEnabled === 'boolean'
    && Number.isInteger(workspace.subjectBridgeColor)
    && Number(workspace.subjectBridgeColor) >= 0
    && Number.isInteger(workspace.selectedColor)
    && Number(workspace.selectedColor) >= 0
    && validViews.includes(workspace.view as BeadView)
    && typeof workspace.zoom === 'number'
    && workspace.zoom >= 40
    && workspace.zoom <= 220
}

export async function loadLocalWorkspace(): Promise<LocalWorkspace | null> {
  const database = await openDatabase()
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(LATEST_WORKSPACE_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('无法读取本地工作区'))
    })
    return isLocalWorkspace(value) ? value : null
  } finally {
    database.close()
  }
}

export async function saveLocalWorkspace(workspace: LocalWorkspace): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(workspace, LATEST_WORKSPACE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地工作区'))
      transaction.onabort = () => reject(transaction.error ?? new Error('本地工作区保存已中止'))
    })
  } finally {
    database.close()
  }
}
