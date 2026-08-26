import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function shanghaiDate(date = new Date()) {
  const parts = Object.fromEntries(
    SHANGHAI_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function visitorHash(date, visitorId) {
  return createHash('sha256').update(`${date}:${visitorId}`).digest('hex')
}

function validState(value) {
  return value
    && typeof value === 'object'
    && typeof value.date === 'string'
    && Array.isArray(value.visitors)
    && value.visitors.every((visitor) => typeof visitor === 'string' && /^[a-f0-9]{64}$/.test(visitor))
}

export class VisitStore {
  constructor({ filePath, now = () => new Date() }) {
    this.filePath = filePath
    this.now = now
    this.state = { date: shanghaiDate(now()), visitors: new Set() }
    this.queue = Promise.resolve()
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (validState(parsed) && parsed.date === shanghaiDate(this.now())) {
        this.state = { date: parsed.date, visitors: new Set(parsed.visitors) }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  register(visitorId) {
    return this.#run(async () => {
      this.#rollDate()
      const before = this.state.visitors.size
      this.state.visitors.add(visitorHash(this.state.date, visitorId))
      if (this.state.visitors.size !== before) await this.#persist()
      return this.state.visitors.size
    })
  }

  count() {
    return this.#run(async () => {
      this.#rollDate()
      return this.state.visitors.size
    })
  }

  #run(operation) {
    const result = this.queue.then(operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  #rollDate() {
    const today = shanghaiDate(this.now())
    if (today !== this.state.date) this.state = { date: today, visitors: new Set() }
  }

  async #persist() {
    const directory = dirname(this.filePath)
    const temporaryPath = join(directory, `.visits-${randomUUID()}.tmp`)
    await mkdir(directory, { recursive: true })
    await writeFile(temporaryPath, JSON.stringify({
      date: this.state.date,
      visitors: [...this.state.visitors],
    }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.filePath)
  }
}

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw Object.assign(new Error('请求内容过大'), { statusCode: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求格式无效'), { statusCode: 400 })
  }
}

export function createVisitServer(store) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname === '/health' && request.method === 'GET') {
        json(response, 200, { ok: true })
        return
      }
      if (url.pathname !== '/visits') {
        json(response, 404, { error: 'Not found' })
        return
      }
      if (request.method === 'GET') {
        json(response, 200, { count: await store.count() })
        return
      }
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'GET, POST')
        json(response, 405, { error: 'Method not allowed' })
        return
      }

      const payload = await readJson(request)
      if (typeof payload?.visitorId !== 'string' || payload.visitorId.length < 8 || payload.visitorId.length > 128) {
        json(response, 400, { error: 'visitorId 无效' })
        return
      }
      json(response, 200, { count: await store.register(payload.visitorId) })
    } catch (error) {
      console.error(error)
      json(response, error?.statusCode ?? 500, { error: error?.statusCode ? error.message : 'Internal server error' })
    }
  })
}

async function start() {
  const host = process.env.HOST ?? '127.0.0.1'
  const port = Number.parseInt(process.env.PORT ?? '8787', 10)
  const filePath = process.env.VISIT_COUNTER_DATA_FILE
    ?? join(process.cwd(), 'data', 'visits.json')
  const store = new VisitStore({ filePath })
  await store.load()
  const server = createVisitServer(store)
  server.listen(port, host, () => console.log(`visit counter listening on http://${host}:${port}`))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
