import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { VisitStore, shanghaiDate } from './visit-counter.mjs'

test('uses the Shanghai calendar date', () => {
  assert.equal(shanghaiDate(new Date('2026-08-26T15:59:59Z')), '2026-08-26')
  assert.equal(shanghaiDate(new Date('2026-08-26T16:00:00Z')), '2026-08-27')
})

test('deduplicates a browser, persists hashes, and resets on a new day', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xiaomin-pindou-visits-'))
  const filePath = join(directory, 'visits.json')
  let currentTime = new Date('2026-08-26T10:00:00Z')

  try {
    const store = new VisitStore({ filePath, now: () => currentTime })
    await store.load()
    assert.equal(await store.register('browser-a'), 1)
    assert.equal(await store.register('browser-a'), 1)
    assert.equal(await store.register('browser-b'), 2)

    const saved = await readFile(filePath, 'utf8')
    assert.equal(saved.includes('browser-a'), false)

    const restored = new VisitStore({ filePath, now: () => currentTime })
    await restored.load()
    assert.equal(await restored.count(), 2)

    currentTime = new Date('2026-08-26T16:00:00Z')
    assert.equal(await restored.count(), 0)
    assert.equal(await restored.register('browser-a'), 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
