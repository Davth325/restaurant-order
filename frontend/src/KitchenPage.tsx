import { useCallback, useEffect, useRef, useState } from 'react'
import { api, jsonPost } from './auth'
import './KitchenPage.css'

type Unit = { id: number; itemId: number; number: number; status: 'QUEUED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'SERVED' | 'CANCELLED'; batchId: number; batchNumber: number; sessionId: number; tableCode: string; createdAt: string; name: string; quantity: number; note: string; guestCancelled?: boolean; billExcluded?: boolean; cancellationReason?: string }
type Snapshot = { units: Unit[]; observedAt: string }
const labels = { QUEUED: 'Chờ làm', PREPARING: 'Đang làm', READY: 'Đã xong', PICKED_UP: 'Đang mang', SERVED: 'Đã phục vụ', CANCELLED: 'Đã hủy · ngừng làm / không mang' }

export default function KitchenPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [stale, setStale] = useState(true)
  const [stream, setStream] = useState(false)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'active' | 'ready' | 'exceptions'>('active')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now)
  const reading = useRef<AbortController | null>(null)
  const acting = useRef(false)
  const mounted = useRef(false)
  const load = useCallback(async () => {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    try {
      const response = await api('/api/kitchen/orders', { signal: controller.signal })
      if (controller.signal.aborted || !mounted.current) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (!response.ok) throw new Error('Unavailable')
      const data: Snapshot = await response.json()
      if (!Array.isArray(data.units) || !data.observedAt || data.units.some(u => !labels[u.status] || !u.id || !u.name || !Number.isFinite(Date.parse(u.createdAt)))) throw new Error('Invalid snapshot')
      if (controller.signal.aborted || !mounted.current) return
      setSnapshot(data)
      setStale(false)
    } catch {
      if (!controller.signal.aborted && mounted.current) setStale(true)
    }
  }, [onUnauthorized])

  useEffect(() => {
    mounted.current = true
    let source: EventSource
    let lastEvent = Date.now()
    const connect = () => {
      source?.close()
      source = new EventSource('/api/kitchen/events')
      const received = (event: Event) => {
        if (!mounted.current) return
        lastEvent = Date.now()
        setStream(true)
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
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      mounted.current = false
      source?.close()
      reading.current?.abort()
      window.clearInterval(timer)
      window.clearInterval(poll)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [load])

  const transition = async (unit: Unit) => {
    if (acting.current || stale || !['QUEUED', 'PREPARING'].includes(unit.status)) return
    acting.current = true
    setBusy(true)
    setMessage('')
    try {
      const response = await jsonPost(`/api/kitchen/units/${unit.id}/status`, { status: unit.status === 'QUEUED' ? 'PREPARING' : 'READY' })
      if (!mounted.current) return
      if (response.status === 401) { onUnauthorized(); return }
      if (!response.ok) {
        const problem = await response.json().catch(() => ({})) as { detail?: string; code?: string }
        if (problem.code === 'KITCHEN_REQUIRED') { onUnauthorized(); return }
        setMessage(problem.detail || 'Chưa xác nhận được thao tác. Kiểm tra trạng thái mới trước khi tiếp tục.')
      }
    } catch {
      if (mounted.current) setMessage('Chưa xác định kết quả thao tác. Đang đọc lại hệ thống; không tự chuyển thêm suất.')
    } finally {
      if (mounted.current) {
        setStale(true)
        await load()
        setBusy(false)
      }
      acting.current = false
    }
  }

  const batches = new Map<number, Map<number, Unit[]>>()
  for (const unit of snapshot?.units ?? []) {
    if (!batches.has(unit.batchId)) batches.set(unit.batchId, new Map())
    const items = batches.get(unit.batchId)!
    items.set(unit.itemId, [...(items.get(unit.itemId) ?? []), unit])
  }
  const activeBatches = [...batches].filter(([, items]) => [...items.values()].some(units => units.some(unit => ['QUEUED', 'PREPARING'].includes(unit.status))))
  const readyBatches = [...batches].filter(([, items]) => [...items.values()].every(units => units.every(unit => !['QUEUED', 'PREPARING'].includes(unit.status))) && [...items.values()].some(units => units.some(unit => ['READY', 'PICKED_UP'].includes(unit.status))))
  const exceptions = [...batches].filter(([, items]) => [...items.values()].some(units => units.some(unit => unit.billExcluded)))
  const visibleBatches = view === 'active' ? activeBatches : view === 'ready' ? readyBatches : exceptions
  const count = (status: Unit['status']) => snapshot?.units.filter(u => u.status === status).length ?? 0
  return <main className="internal-page kitchen-page">
    <div className="kitchen-heading"><div><p className="eyebrow">MỖI SUẤT · ĐÚNG BÀN</p><h1>Khu vực bếp</h1><p className="intro">Bắt đầu làm và xác nhận từng suất. Món xong chờ nhân viên mang.</p></div><button className="refresh" onClick={() => void load()}>Tải lại hàng đợi</button></div>
    <p className={`kitchen-connection ${stale || !stream ? 'degraded' : ''}`} role="status">{stale ? 'Chưa đọc được trạng thái mới từ máy chủ · Đã khóa thao tác' : stream ? 'Đang kết nối hệ thống quán · Cập nhật trực tiếp' : 'Mất kết nối cập nhật trực tiếp · Đang tải lại mỗi 15 giây'}</p>
    {snapshot && <p className="kitchen-observed">Đọc gần nhất: {new Date(snapshot.observedAt).toLocaleTimeString('vi-VN')}</p>}
    {message && <p className="kitchen-message" role="alert">{message}</p>}
    {stale && <div className="error-banner" role="alert">{snapshot ? 'Dữ liệu có thể đã cũ. Nối lại máy chủ rồi tải lại để kiểm tra trước khi làm tiếp.' : 'Đang tải hàng đợi. Nếu chưa kết nối được hệ thống quán, hãy kiểm tra máy chủ rồi tải lại.'}</div>}
    <div className="kitchen-summary" aria-label="Tổng số suất"><span><strong>{count('QUEUED')}</strong> Chờ làm</span><span><strong>{count('PREPARING')}</strong> Đang làm</span><span><strong>{count('READY')}</strong> Đã xong · chờ mang</span><span><strong>{count('PICKED_UP')}</strong> Đang mang</span><span><strong>{count('SERVED')}</strong> Đã phục vụ</span></div>
    <nav className="kitchen-views" aria-label="Lọc đợt gọi">
      <button aria-pressed={view === 'active'} onClick={() => setView('active')}>Đang xử lý ({activeBatches.length} đợt)</button>
      <button aria-pressed={view === 'ready'} onClick={() => setView('ready')}>Đã xong · chờ mang ({readyBatches.length} đợt)</button>
      <button aria-pressed={view === 'exceptions'} onClick={() => setView('exceptions')}>Món đã hủy / loại tiền ({exceptions.length} đợt)</button>
    </nav>
    {snapshot && visibleBatches.length === 0 && <p className="empty-state">{view === 'ready' ? 'Chưa có đợt đã xong còn chờ mang hoặc đang mang.' : batches.size === 0 ? 'Chưa có món đã gửi. Món mới sẽ tự xuất hiện tại đây.' : 'Đã làm xong mọi đợt hiện có. Mở mục Đã xong · chờ mang để xem lại.'}</p>}
    <div className="kitchen-batches">{visibleBatches.map(([batchId, items]) => {
      const first = [...items.values()][0][0]
      const elapsed = Math.max(0, Math.floor((now - Date.parse(first.createdAt)) / 60000))
      const unfinished = [...items.values()].flat().some(u => ['QUEUED', 'PREPARING'].includes(u.status))
      return <article className={`kitchen-batch ${unfinished && elapsed >= 15 ? 'waiting-long' : ''}`} key={batchId} aria-label={`${first.tableCode} đợt ${first.batchNumber}`}>
        <header><h2>{first.tableCode} <span>Đợt {first.batchNumber}</span></h2><p>{unfinished ? 'Chờ từ lúc gửi' : 'Gửi'} · {elapsed < 1 ? 'Dưới 1 phút' : `${elapsed} phút`}{unfinished && elapsed >= 15 && ' · Chờ lâu'}</p><small>Phiên #{first.sessionId} · Mã đợt #{batchId} · {new Date(first.createdAt).toLocaleTimeString('vi-VN')}</small></header>
        {[...items].map(([itemId, units]) => <section className="kitchen-item" key={itemId} aria-label={units[0].name}>
          <h3>{units[0].quantity} × {units[0].name}</h3>
          <p className="kitchen-progress">{units.filter(u => ['READY', 'PICKED_UP', 'SERVED'].includes(u.status)).length}/{units[0].quantity} đã xong · {units.filter(u => u.status === 'QUEUED').length} chờ làm · {units.filter(u => u.status === 'PREPARING').length} đang làm</p>
          {units[0].note && <p className="kitchen-note"><strong>Ghi chú:</strong> {units[0].note}</p>}
          <div className="kitchen-units">{units.map(unit => <div className={`kitchen-unit unit-${unit.status.toLowerCase()}`} key={unit.id}><span>Suất {unit.number} · {labels[unit.status]}{unit.guestCancelled && ' · Khách đã hủy'}{unit.billExcluded && ' · Đã loại khỏi tạm tính'}{unit.cancellationReason && ` · Lý do: ${unit.cancellationReason}`}</span>{['QUEUED', 'PREPARING'].includes(unit.status) ? <button disabled={stale || busy} onClick={() => void transition(unit)} aria-label={`${unit.status === 'QUEUED' ? 'Bắt đầu' : 'Hoàn thành'} suất ${unit.number} ${unit.name}`}>{unit.status === 'QUEUED' ? 'Bắt đầu làm' : 'Xác nhận xong'}</button> : <strong>{unit.status === 'READY' ? '✓ Chờ mang' : labels[unit.status]}</strong>}</div>)}</div>
        </section>)}
      </article>
    })}</div>
  </main>
}
