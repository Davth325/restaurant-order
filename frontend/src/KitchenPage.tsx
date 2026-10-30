import { useCallback, useEffect, useState } from 'react'
import { api } from './auth'

export default function KitchenPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api('/api/kitchen/workspace', { signal })
      if (signal?.aborted) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (!response.ok) throw new Error('Unavailable')
      setState('ready')
    } catch {
      if (!signal?.aborted) setState('error')
    }
  }, [onUnauthorized])
  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => load(controller.signal))
    return () => controller.abort()
  }, [load])
  return <main className="internal-page"><p className="eyebrow">KHU VỰC NỘI BỘ</p><h1>Khu vực bếp</h1>
    {state === 'loading' && <p className="intro" role="status">Đang kiểm tra quyền truy cập…</p>}
    {state === 'ready' && <p className="intro">Đã vào khu vực bếp. Hàng đợi món sẽ được triển khai ở bước sau.</p>}
    {state === 'error' && <div className="error-banner" role="alert"><p>Chưa kết nối được hệ thống quán.</p><button onClick={() => { setState('loading'); void load() }}>Thử lại</button></div>}
  </main>
}
