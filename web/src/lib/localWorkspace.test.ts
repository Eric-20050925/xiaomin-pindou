import { describe, expect, it } from 'vitest'
import { isLocalWorkspace, type LocalWorkspace } from './localWorkspace'

const workspace: LocalWorkspace = {
  schema: 'pindou-local-workspace',
  version: 1,
  savedAt: '2026-08-26T00:00:00.000Z',
  title: '测试图纸',
  paletteId: 'mard-221-alfonse-doudou',
  grid: { width: 2, height: 2, cells: [0, 1, -1, 2] },
  sourceName: 'test.png',
  sourceBlob: null,
  targetWidth: 2,
  targetHeight: 2,
  detailPreset: 'custom',
  ratioLocked: true,
  maxColors: 24,
  subjectEnabled: false,
  subjectBridgeEnabled: true,
  subjectBridgeColor: 0,
  selectedColor: 1,
  view: 'pattern',
  zoom: 100,
}

describe('local workspace validation', () => {
  it('accepts a complete workspace snapshot', () => {
    expect(isLocalWorkspace(workspace)).toBe(true)
  })

  it('rejects a workspace with a mismatched grid', () => {
    expect(isLocalWorkspace({ ...workspace, grid: { ...workspace.grid, cells: [0] } })).toBe(false)
  })

  it('rejects unsupported view and detail values', () => {
    expect(isLocalWorkspace({ ...workspace, view: 'unknown' })).toBe(false)
    expect(isLocalWorkspace({ ...workspace, detailPreset: 'huge' })).toBe(false)
  })
})
