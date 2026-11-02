import { useEffect, useRef, useState } from 'react'
import { api, jsonPost, type Staff } from './auth'
import { useServingSnapshot, type ServingUnit } from './useServingSnapshot'
import './KitchenPage.css'
import './ServingPage.css'

type Action = 'PICK_UP' | 'RETURN' | 'SERVE'
type Pending = { unitId: number; table: string; name: string; number: number; body: { requestKey: string; version: number; action: Action; reason: string } }
type History = { requestKey: string; actor: string; actorName: string; action: Action; reason: string; occurredAt: string }
const actions = { PICK_UP: 'Nhận mang', RETURN: 'Trả lại hàng đợi', SERVE: 'Xác nhận đã giao' }
const labels = { READY: 'Đã xong ở bếp', PICKED_UP: 'Đã có nhân viên nhận mang', SERVED: 'Đã phục vụ' }
function readPending(key: string): Pending | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as Pending | null } catch { return null }
}

export default function ServingPage({ staff, onUnauthorized }: { staff: Staff; onUnauthorized: () => void }) {
  const { snapshot, stale, stream, now, load, mounted, setStale } = useServingSnapshot(onUnauthorized)
  const storageKey = `serving-pending:${staff.username}`
  const [pending, setPending] = useState<Pending | null>(() => readPending(storageKey))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [view, setView] = useState<'READY' | 'PICKED_UP' | 'SERVED'>('READY')
  const [returning, setReturning] = useState<ServingUnit | null>(null)
  const [reason, setReason] = useState('')
  const [historyUnit, setHistoryUnit] = useState<number | null>(null)
  const [history, setHistory] = useState<History[] | null>(null)
  const acting = useRef(false)
  const historyVersion = useRef(0)
  const returnPanel = useRef<HTMLElement | null>(null)
  useEffect(() => { if (returning) returnPanel.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [returning])
  const clearPending = () => { localStorage.removeItem(storageKey); setPending(null) }
  const send = async (command: Pending) => {
    const response = await jsonPost(`/api/serving/units/${command.unitId}/actions`, command.body)
    if (!mounted.current) return
    if (response.status === 401) { onUnauthorized(); return }
    if (response.ok) { clearPending(); setMessage('Đã lưu thao tác. Trạng thái được đọc lại từ hệ thống.'); setReturning(null); setReason(''); return }
    const problem = await response.json().catch(() => ({})) as { code?: string; detail?: string }
    if (problem.code === 'SERVING_REQUIRED') { onUnauthorized(); return }
    // A definite rejection does not need a new attempt. 5xx may hide a committed response.
    if (response.status >= 400 && response.status < 500) clearPending()
    setMessage(problem.detail || 'Chưa xác định kết quả. Kiểm tra thao tác trước khi tiếp tục.')
  }
  const finish = async () => {
    if (mounted.current) { setStale(true); await load(); setBusy(false) }
    acting.current = false
  }
  const transition = async (unit: ServingUnit, action: Action) => {
    if (acting.current || stale || pending) return
    const command: Pending = { unitId: unit.id, table: unit.tableCode, name: unit.name, number: unit.number, body: { requestKey: crypto.randomUUID(), version: unit.version, action, reason: action === 'RETURN' ? reason.trim() : '' } }
    acting.current = true; setBusy(true); setMessage('')
    try {
      // Persist before POST; a reload must keep exactly this operation and version.
      localStorage.setItem(storageKey, JSON.stringify(command)); setPending(command)
      await send(command)
    } catch { if (mounted.current) setMessage('Chưa xác định kết quả. Giữ nguyên thao tác để kiểm tra; không nhận/giao thêm suất.') }
    finally { await finish() }
  }
  const resolve = async (retry: boolean) => {
    if (!pending || acting.current) return
    acting.current = true; setBusy(true); setMessage('')
    try {
      const response = await api(`/api/serving/operations/${pending.body.requestKey}`)
      if (!mounted.current) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (response.ok) {
        const receipt = await response.json() as { unitId: number; actor: string; version: number; action: Action; reason: string }
        if (receipt.unitId !== pending.unitId || receipt.actor !== staff.username || receipt.version !== pending.body.version || receipt.action !== pending.body.action || receipt.reason !== pending.body.reason) {
          clearPending(); setMessage('Khóa thao tác đã được dùng với nội dung khác. Hãy đối chiếu trạng thái mới trước khi tiếp tục.'); return
        }
        clearPending(); setMessage('Đã tìm thấy thao tác được lưu. Đã tải lại trạng thái.'); setReturning(null); setReason('')
      }
      else if (response.status === 404 && retry) await send(pending)
      else if (response.status === 404) setMessage('Chưa thấy thao tác được lưu. Bấm Kiểm tra và thử lại để gửi cùng thao tác nếu cần.')
      else throw new Error('Unavailable')
    } catch { if (mounted.current) setMessage('Chưa tra được kết quả thao tác. Nối lại hệ thống rồi kiểm tra; không tạo thao tác thay thế.') }
    finally { await finish() }
  }
  // On reload only look up the key. Never automatically replay a command.
  const initialPending = useRef(pending)
  useEffect(() => {
    if (initialPending.current) void Promise.resolve().then(() => { if (mounted.current) void resolve(false) })
    // This recovery is intentionally once per mounted staff page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const showHistory = async (unit: ServingUnit) => {
    const version = ++historyVersion.current
    setHistoryUnit(unit.id); setHistory(null)
    try {
      const response = await api(`/api/serving/units/${unit.id}/history`)
      if (!mounted.current) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (!response.ok) throw new Error('Unavailable')
      const data = await response.json() as History[]
      if (mounted.current && version === historyVersion.current) setHistory(data)
    } catch { if (mounted.current) setMessage('Chưa đọc được lịch sử. Vui lòng thử lại.') }
  }
  const units = (snapshot?.units ?? []).filter(unit => staff.role === 'MANAGER' || unit.status === 'READY' || (unit.status === 'PICKED_UP' && unit.pickedUpBy === staff.username))
  const groups = new Map<number, ServingUnit[]>()
  for (const unit of units.filter(u => u.status === view)) groups.set(unit.itemId, [...(groups.get(unit.itemId) ?? []), unit])
  const locked = stale || busy || !!pending
  return <main className="internal-page kitchen-page serving-page">
    <div className="kitchen-heading"><div><p className="eyebrow">TỪ BẾP TỚI BÀN</p><h1>{staff.role === 'MANAGER' ? 'Giám sát phục vụ' : 'Mang món & phục vụ'}</h1><p className="intro">Nhận từng suất và xác nhận khi đã giao tới khách.</p></div><button className="refresh" onClick={() => void load()}>Tải lại món phục vụ</button></div>
    <p className={`kitchen-connection ${stale || !stream ? 'degraded' : ''}`} role="status">{stale ? 'Dữ liệu có thể đã cũ · Đã khóa thao tác' : stream ? 'Đang kết nối hệ thống quán · Cập nhật trực tiếp' : 'Mất kết nối cập nhật trực tiếp · Đang tải lại mỗi 15 giây'}</p>
    {snapshot && <p className="kitchen-observed">Đọc gần nhất: {new Date(snapshot.observedAt).toLocaleTimeString('vi-VN')}</p>}
    {message && <p role="alert" className="kitchen-message">{message}</p>}
    {stale && <div className="error-banner" role="alert">{snapshot ? 'Dữ liệu có thể đã cũ. Tải lại thành công trước khi nhận hoặc giao.' : 'Đang tải món phục vụ. Kiểm tra kết nối nếu chờ lâu.'}</div>}
    {pending && <section className="serving-recovery" aria-label="Thao tác chưa rõ kết quả"><strong>Cần kiểm tra: {actions[pending.body.action]} · {pending.table} · suất {pending.number} {pending.name}</strong><p>Không bấm lại bằng một thao tác mới. Hệ thống tra kết quả trước khi thử lại cùng lượt.</p><button disabled={busy} onClick={() => void resolve(true)}>Kiểm tra và thử lại</button></section>}
    {staff.role === 'MANAGER' && <p>Quản lý xem mọi suất và lịch sử; được trả lại suất nhận nhầm khi có lý do. Nhân viên nhận món trực tiếp.</p>}
    <nav className="kitchen-views" aria-label="Lọc phục vụ">{(['READY', 'PICKED_UP', 'SERVED'] as const).filter(status => status !== 'SERVED' || staff.role === 'MANAGER').map(status => <button key={status} aria-pressed={view === status} onClick={() => setView(status)}>{status === 'READY' ? 'Chờ mang' : status === 'PICKED_UP' ? 'Đang mang' : 'Đã phục vụ'} ({units.filter(u => u.status === status).length} suất)</button>)}</nav>
    {view === 'PICKED_UP' && staff.role === 'STAFF' && <p className="kitchen-observed">Chỉ hiển thị món bạn đã nhận mang.</p>}
    {snapshot && groups.size === 0 && <p className="empty-state">{view === 'READY' ? 'Không có món chờ mang.' : view === 'PICKED_UP' ? staff.role === 'STAFF' ? 'Bạn chưa có suất đang mang.' : 'Không có suất đang mang.' : 'Chưa có suất đã phục vụ.'}</p>}
    <div className="kitchen-batches">{[...groups].map(([itemId, portions]) => {
      const first = portions[0]
      return <article className="kitchen-batch" key={itemId} aria-label={`${first.tableCode} đợt ${first.batchNumber} ${first.name}`}>
        <header><h2>{first.tableCode} <span>Đợt {first.batchNumber}</span></h2><p>Phiên #{first.sessionId} · {portions.length}/{first.quantity} suất {view === 'READY' ? 'chờ mang' : view === 'PICKED_UP' ? 'đang mang' : 'đã phục vụ'}</p></header>
        <section className="kitchen-item"><h3>{first.name}</h3>{first.note && <p className="kitchen-note"><strong>Ghi chú:</strong> {first.note}</p>}
          <div className="serving-units">{portions.map(unit => {
            const owner = unit.pickedUpBy === staff.username
            const wait = Math.max(0, Math.floor((now - Date.parse(unit.readyAt)) / 60000))
            return <section className={`serving-unit unit-${unit.status.toLowerCase()}`} key={unit.id} aria-label={`Suất ${unit.number} ${unit.name}`}>
              <strong>Suất {unit.number} · {labels[unit.status]}</strong>
              {unit.status === 'READY' && <p>Chờ từ bếp xong: {wait < 1 ? 'Dưới 1 phút' : `${wait} phút`} · {new Date(unit.readyAt).toLocaleTimeString('vi-VN')}</p>}
              {unit.pickedUpBy && <p>Người nhận: {unit.pickedUpName} ({unit.pickedUpBy}) · {new Date(unit.pickedUpAt!).toLocaleTimeString('vi-VN')}</p>}
              {unit.servedAt && <p>Đã giao lúc {new Date(unit.servedAt).toLocaleTimeString('vi-VN')}</p>}
              <div className="serving-actions">
                {unit.status === 'READY' && staff.role === 'STAFF' && <button disabled={locked} onClick={() => void transition(unit, 'PICK_UP')}>Nhận mang suất {unit.number}</button>}
                {unit.status === 'PICKED_UP' && owner && staff.role === 'STAFF' && <button disabled={locked} onClick={() => void transition(unit, 'SERVE')}>Đã giao suất {unit.number}</button>}
                {unit.status === 'PICKED_UP' && (owner || staff.role === 'MANAGER') && <button disabled={locked} onClick={() => { setReturning(unit); setReason('') }}>Trả lại suất {unit.number}</button>}
                {staff.role === 'MANAGER' && <button onClick={() => void showHistory(unit)}>Lịch sử suất {unit.number}</button>}
              </div>
            </section>
          })}</div>
        </section>
      </article>
    })}</div>
    {returning && <section ref={returnPanel} className="serving-return" aria-label="Xác nhận trả lại"><h2>Trả lại {returning.tableCode} · suất {returning.number} {returning.name}</h2><label>Lý do trả lại<textarea maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></label><p>Suất trở về Chờ mang. Lịch sử giữ người nhận và người trả lại.</p><button disabled={locked || !reason.trim()} onClick={() => void transition(returning, 'RETURN')}>Xác nhận trả lại</button><button disabled={busy || !!pending} onClick={() => setReturning(null)}>Đóng</button></section>}
    {staff.role === 'MANAGER' && historyUnit !== null && <section className="serving-history" aria-label="Lịch sử phục vụ"><h2>Lịch sử suất #{historyUnit}</h2>{history === null ? <p>Chưa đọc được lịch sử…</p> : history.length === 0 ? <p>Chưa có thao tác phục vụ.</p> : <ol>{history.map(event => <li key={event.requestKey}><strong>{actions[event.action]}</strong> · {event.actorName} ({event.actor}) · {new Date(event.occurredAt).toLocaleString('vi-VN')}{event.reason && <p>Lý do: {event.reason}</p>}</li>)}</ol>}<button onClick={() => { historyVersion.current++; setHistoryUnit(null) }}>Đóng lịch sử</button></section>}
  </main>
}
