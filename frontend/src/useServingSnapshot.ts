import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './auth'

export type ServingUnit = { id: number; itemId: number; number: number; status: 'READY' | 'PICKED_UP' | 'SERVED'; version: number; batchId: number; batchNumber: number; sessionId: number; tableCode: string; name: string; quantity: number; note: string; readyAt: string; pickedUpBy: string | null; pickedUpName: string | null; pickedUpAt: string | null; servedAt: string | null }
type Snapshot = { units: ServingUnit[]; observedAt: string }

export function useServingSnapshot(onUnauthorized: () => void) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [stale, setStale] = useState(true)
  const [stream, setStream] = useState(false)
  const [now, setNow] = useState(Date.now)
  const mounted = useRef(false)
  const reading = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    try {
      const response = await api('/api/serving/orders', { signal: controller.signal })
      if (controller.signal.aborted || !mounted.current) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (!response.ok) throw new Error('Unavailable')
      const data: Snapshot = await response.json()
      if (!Array.isArray(data.units) || !data.observedAt || data.units.some(u => !['READY', 'PICKED_UP', 'SERVED'].includes(u.status) || !u.id || !u.name || !Number.isSafeInteger(u.version) || !Number.isFinite(Date.parse(u.readyAt)))) throw new Error('Invalid snapshot')
      if (controller.signal.aborted || !mounted.current) return
      setSnapshot(data); setStale(false)
    } catch { if (!controller.signal.aborted && mounted.current) setStale(true) }
  }, [onUnauthorized])
  useEffect(() => {
    mounted.current = true
    let source: EventSource
    let lastEvent = Date.now()
    const connect = () => {
      source?.close()
      source = new EventSource('/api/serving/events')
      const received = (event: Event) => {
        if (!mounted.current) return
        lastEvent = Date.now(); setStream(true)
        if (event.type !== 'heartbeat') void load()
      }
      for (const name of ['connected', 'changed', 'heartbeat']) source.addEventListener(name, received)
      source.onerror = () => { if (mounted.current) { setStream(false); void load() } }
    }
    void Promise.resolve().then(() => { if (mounted.current) { void load(); connect() } })
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() - lastEvent > 25000) { setStream(false); lastEvent = Date.now(); connect() }
    }, 5000)
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15000)
    const resume = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', resume); window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      mounted.current = false; source?.close(); reading.current?.abort()
      window.clearInterval(timer); window.clearInterval(poll)
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [load])
  return { snapshot, stale, stream, now, load, mounted, setStale }
}
