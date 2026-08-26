import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'

const VISITOR_ID_KEY = 'xiaomin-pindou-visitor-id'

function createVisitorId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`
}

function getVisitorId() {
  try {
    const stored = window.localStorage.getItem(VISITOR_ID_KEY)
    if (stored) return stored
    const visitorId = createVisitorId()
    window.localStorage.setItem(VISITOR_ID_KEY, visitorId)
    return visitorId
  } catch {
    return createVisitorId()
  }
}

type DailyVisitorCountProps = {
  screen: 'home' | 'editor'
}

export function DailyVisitorCount({ screen }: DailyVisitorCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId() }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('访客计数服务暂不可用')
        return response.json() as Promise<{ count?: unknown }>
      })
      .then((payload) => {
        if (Number.isSafeInteger(payload.count) && Number(payload.count) >= 0) {
          setCount(Number(payload.count))
        }
      })
      .catch(() => {
        // 计数属于辅助信息，服务不可用时不打断主要设计流程。
      })

    return () => controller.abort()
  }, [])

  if (count === null) return null

  return (
    <aside
      className={`daily-visitor-count ${screen === 'editor' ? 'editor' : ''}`}
      aria-label={`今日访问人数 ${count} 人`}
      aria-live="polite"
    >
      <UsersRound aria-hidden="true" size={15} strokeWidth={2.2} />
      <span>今日访问</span>
      <strong>{count.toLocaleString('zh-CN')}</strong>
      <small>人</small>
    </aside>
  )
}
