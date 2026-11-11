import { useCallback, useEffect, useRef, useState } from 'react'
import { api, jsonPost, type Staff } from './auth'
import './GuestPage.css'

type Unit = { id: number; version: number; status: string; excluded: boolean; sessionId: number; tableCode: string; batchId: number; name: string; number: number; priceVnd: number }
type Attempt = { requestKey: string; unitId: number; reason?: string; version?: number; action?: string; cancellationKey?: string | null }
type Operation = { requestKey: string; unitId: number; action: string; reason: string | null; actor: string; fromStatus: string; toStatus: string; occurredAt: string }
const labels: Record<string, string> = { QUEUED: 'Chờ bếp', PREPARING: 'Đang làm', READY: 'Chờ mang', PICKED_UP: 'Đang mang', SERVED: 'Đã phục vụ', CANCELLED: 'Đã hủy' }
const actionLabels: Record<string, string> = { GUEST_CANCEL: 'Tự hủy', APPROVE: 'Duyệt yêu cầu hủy', REJECT: 'Từ chối yêu cầu', CANCEL: 'Hủy trực tiếp', EXCLUDE: 'Loại khỏi tạm tính' }

export default function CancellationPanel({ sessionId, staff, onChanged, onUnauthorized }: { sessionId?: number; staff?: Staff; onChanged?: () => void; onUnauthorized?: () => void }) {
  const root = staff ? '/api/cancellations' : `/api/guest/sessions/${sessionId}/cancellations`
  const storage = staff ? `cancel-pending:staff:${staff.username}` : `guest-self-cancel-pending:${sessionId}`
  const [units, setUnits] = useState<Unit[]>([])
  const [pending, setPending] = useState<Attempt | null>(null)
  const [stale, setStale] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<{ unit: Unit; action?: string } | null>(null)
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<Operation[] | null>(null)
  const acting = useRef(false)
  const reading = useRef<AbortController | null>(null)
  const changed = useRef(onChanged)
  useEffect(() => { changed.current = onChanged }, [onChanged])
  const load = useCallback(async () => {
    reading.current?.abort()
    const controller = new AbortController(); reading.current = controller
    try {
      const response = await api(staff ? `${root}/units` : root, { signal: controller.signal })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { setUnits([]); setHistory(null); setForm(null); onUnauthorized?.() }
        throw new Error('Chưa đọc được trạng thái món. Kiểm tra kết nối và tải lại.')
      }
      const data: Unit[] = await response.json()
      if (!Array.isArray(data) || data.some(u => !labels[u.status] || !Number.isSafeInteger(u.id))) throw new Error('Dữ liệu yêu cầu hủy không hợp lệ.')
      if (!controller.signal.aborted) { setUnits(data); setStale(false) }
    } catch (error) { if (!controller.signal.aborted) { setStale(true); setMessage((error as Error).message) } }
  }, [root, staff, onUnauthorized])
  const clear = () => { localStorage.removeItem(storage); setPending(null); setForm(null); setReason('') }
  const lookup = async (attempt: Attempt) => {
    const response = await api(staff ? `${root}/operations/${attempt.requestKey}` : `${root}/cancel/by-key/${attempt.requestKey}`)
    if (response.status === 404) return false
    if (!response.ok) throw new Error('Chưa tra được kết quả. Giữ nguyên lượt và kiểm tra lại.')
    const receipt = await response.json() as Attempt
    if (receipt.requestKey !== attempt.requestKey || receipt.unitId !== attempt.unitId || receipt.reason !== attempt.reason
      || (staff && (receipt.version !== attempt.version || receipt.action !== attempt.action || receipt.cancellationKey !== attempt.cancellationKey)))
      throw new Error('Biên nhận khác nội dung đang chờ. Gọi quản lý kiểm tra, không gửi lượt mới.')
    clear(); setMessage(staff ? 'Đã xác nhận thao tác được lưu.' : 'Đã hủy suất.'); await load(); changed.current?.()
    return true
  }
  useEffect(() => {
    let active = true
    void (async () => {
      await load()
      if (!active) return
      const saved = localStorage.getItem(storage)
      if (saved) {
        try { const attempt = JSON.parse(saved) as Attempt; setPending(attempt); await lookup(attempt) }
        catch (error) { if (active) setMessage((error as Error).message) }
      }
    })()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15000)
    const resume = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', resume); window.addEventListener('online', resume)
    let source: EventSource | undefined
    if (staff) { source = new EventSource('/api/serving/events'); for (const name of ['connected', 'changed']) source.addEventListener(name, resume) }
    return () => { active = false; reading.current?.abort(); clearInterval(timer); source?.close(); window.removeEventListener('focus', resume); window.removeEventListener('online', resume) }
    // Each actor/session mounts its own panel. Reload only looks up a saved command, never POSTs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, storage])
  const send = async () => {
    if (acting.current) return
    let attempt = pending
    if (!attempt) {
      if (!form || stale || (staff && !reason.trim())) return
      attempt = { requestKey: crypto.randomUUID(), unitId: form.unit.id }
      if (staff) {
        attempt.version = form.unit.version
        attempt.action = form.action
        attempt.reason = reason.trim()
        attempt.cancellationKey = null
      }
    }
    acting.current = true; setBusy(true)
    try {
      localStorage.setItem(storage, JSON.stringify(attempt)); setPending(attempt)
      if (pending && await lookup(attempt)) return
      const response = await jsonPost(staff ? `${root}/actions` : `${root}/cancel`, attempt)
      if (response.ok) { clear(); setMessage(staff ? 'Đã lưu điều chỉnh.' : 'Đã hủy suất.'); await load(); changed.current?.(); return }
      const problem = await response.json() as { code?: string; detail?: string }
      if ([400, 403, 409].includes(response.status) && problem.code && problem.code !== 'IDEMPOTENCY_CONFLICT') clear()
      setMessage(problem.detail ?? 'Chưa xử lý được. Hãy kiểm tra lại.'); await load()
    } catch { setMessage('Chưa xác định kết quả. Giữ lượt gửi; bấm Kiểm tra và thử lại để tra trước khi gửi lại cùng khóa.') }
    finally { acting.current = false; setBusy(false) }
  }
  const showHistory = async (unit: Unit) => {
    try {
      const response = await api(`${root}/units/${unit.id}/history`)
      if (response.status === 401 || response.status === 403) { setHistory(null); onUnauthorized?.() }
      if (!response.ok) throw new Error('Không đọc được lịch sử.')
      setHistory(await response.json() as Operation[])
    }
    catch (error) { setMessage((error as Error).message) }
  }
  return <section className="guest-panel cancellation-panel" aria-label="Hủy món">
    <div className="detail-heading"><h2>{staff ? 'Các suất theo bàn' : 'Hủy suất còn chờ bếp'}</h2><button disabled={busy} onClick={() => { void load(); changed.current?.() }}>Tải lại trạng thái món</button></div>
    {message && <p role="status">{message}</p>}{stale && <p role="alert">Dữ liệu hủy có thể đã cũ. Đã khóa thao tác mới tới khi tải lại thành công.</p>}
    {pending && <button disabled={busy} onClick={() => void send()}>Kiểm tra và thử lại</button>}
    {units.length === 0 && <p>Chưa có suất trong mục này.</p>}
    {units.map(unit => <article className="order-batch" key={unit.id}>
      <h3>{unit.tableCode} · Đợt #{unit.batchId} · {unit.name} · Suất {unit.number}</h3>
      <p>{labels[unit.status]}{unit.excluded && ' · Đã loại khỏi tạm tính'}</p>
      {!unit.excluded && <div className="guest-actions">
        {!staff && unit.status === 'QUEUED' && (form?.unit.id === unit.id && !pending
          ? <><button disabled={busy || stale} onClick={() => void send()}>Xác nhận hủy suất {unit.number}</button><button type="button" onClick={() => setForm(null)}>Bỏ qua</button></>
          : <button disabled={busy || stale || !!pending} onClick={() => setForm({ unit })}>Hủy suất {unit.number} {unit.name}</button>)}
        {staff && <button disabled={busy || stale || !!pending} onClick={() => { setForm({ unit, action: unit.status === 'SERVED' ? 'EXCLUDE' : 'CANCEL' }); setReason('') }}>{unit.status === 'SERVED' ? 'Loại khỏi tạm tính' : 'Hủy trực tiếp'} suất {unit.number} {unit.name}</button>}
      </div>}
      {staff?.role === 'MANAGER' && <button onClick={() => void showHistory(unit)}>Lịch sử hủy suất {unit.number} {unit.name}</button>}
    </article>)}
    {staff && form && !pending && <form onSubmit={event => { event.preventDefault(); void send() }} className="order-batch">
      <h3>Xác nhận {form.unit.tableCode} · {form.unit.name} · Suất {form.unit.number} · {form.action === 'EXCLUDE' ? 'Loại khỏi tạm tính' : 'Hủy'}</h3>
      <label>Lý do<textarea autoFocus value={reason} maxLength={300} onChange={event => setReason(event.target.value)} /></label>
      <div className="guest-actions"><button disabled={busy || stale || !reason.trim()}>Xác nhận xử lý</button><button type="button" disabled={busy} onClick={() => setForm(null)}>Bỏ qua</button></div>
    </form>}
    {history && <div className="order-batch"><h3>Lịch sử hủy / loại khỏi tạm tính</h3>{history.length === 0 && <p>Chưa có xử lý.</p>}{history.map(op => <p key={op.requestKey}>{op.actor} · {actionLabels[op.action] ?? op.action} · {labels[op.fromStatus] ?? op.fromStatus} → {labels[op.toStatus] ?? op.toStatus}{op.reason && ` · ${op.reason}`} · {new Date(op.occurredAt).toLocaleString('vi-VN')}</p>)}<button onClick={() => setHistory(null)}>Đóng lịch sử hủy</button></div>}
  </section>
}
