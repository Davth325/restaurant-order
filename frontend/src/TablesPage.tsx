import { useCallback, useEffect, useRef, useState } from 'react'
import { api, authPost } from './auth'

type TableSession = {
  id: number
  status: 'OPEN' | 'CHECKOUT_PENDING'
  openedAt: string
  openedBy: { id: number; username: string; displayName: string }
}
type Table = {
  id: number
  code: string
  displayName: string
  area: string
  seats: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'NEEDS_CLEANING'
  currentSession: TableSession | null
}
type Snapshot = { tables: Table[]; total: number; observedAt: string }

const statusLabels = {
  AVAILABLE: 'Bàn trống',
  OCCUPIED: 'Đang phục vụ',
  NEEDS_CLEANING: 'Chờ dọn',
}

function validTable(value: Table) {
  return value && Number.isSafeInteger(value.id) && value.id > 0 && typeof value.code === 'string'
    && typeof value.displayName === 'string' && typeof value.area === 'string'
    && Number.isInteger(value.seats) && value.seats > 0 && Object.hasOwn(statusLabels, value.status)
    && (value.currentSession === null || (value.currentSession && Number.isSafeInteger(value.currentSession.id)
      && ['OPEN', 'CHECKOUT_PENDING'].includes(value.currentSession.status)
      && Number.isFinite(Date.parse(value.currentSession.openedAt))
      && typeof value.currentSession.openedBy?.username === 'string'
      && typeof value.currentSession.openedBy?.displayName === 'string'))
}

const dateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(value))

function TablesPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [area, setArea] = useState('Tất cả')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const mutation = useRef<AbortController | null>(null)
  const [selected, setSelected] = useState<Table | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [opening, setOpening] = useState(false)
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const detailPanel = useRef<HTMLElement | null>(null)
  const selectedId = selected?.id

  useEffect(() => { detailPanel.current?.scrollIntoView({ block: 'start' }) }, [selectedId])

  const loadTables = useCallback(() => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    return fetch('/api/tables', { signal: controller.signal, cache: 'no-store' })
      .then(response => {
        if (response.status === 401 || response.status === 403) {
          if (activeRequest.current === controller) onUnauthorized()
          throw new Error('Unauthorized')
        }
        if (!response.ok) throw new Error('API unavailable')
        return response.json() as Promise<Snapshot>
      })
      .then(result => {
        if (!Array.isArray(result.tables) || result.total !== result.tables.length
          || !result.tables.every(validTable) || !Number.isFinite(Date.parse(result.observedAt))) {
          throw new Error('Invalid table snapshot')
        }
        if (activeRequest.current === controller) {
          setSnapshot(result)
          setError(false)
        }
      })
      .catch(() => {
        if (activeRequest.current === controller) setError(true)
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (activeRequest.current === controller) setLoading(false)
      })
  }, [onUnauthorized])

  useEffect(() => {
    void loadTables()
    return () => {
      activeRequest.current?.abort()
      activeRequest.current = null
      detailRequest.current?.abort()
      detailRequest.current = null
      mutation.current?.abort()
      mutation.current = null
    }
  }, [loadTables])

  const refresh = () => {
    setLoading(true)
    void loadTables()
    if (selected) void selectTable(selected)
  }

  const selectTable = async (table: Table) => {
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setSelected(table)
    setDetailLoading(true)
    setDetailError('')
    try {
      const response = await api(`/api/tables/${table.id}`, { signal: controller.signal })
      if (response.status === 401 || response.status === 403) {
        if (detailRequest.current === controller) onUnauthorized()
        return
      }
      if (!response.ok) throw new Error('Read failed')
      const result: Table = await response.json()
      if (!validTable(result) || result.id !== table.id) throw new Error('Invalid table')
      if (detailRequest.current !== controller) return
      setSelected(result)
      if (uncertain) setNotice(result.currentSession
        ? `Đã kiểm tra ${result.code}: bàn đã có phiên phục vụ. Không gửi lại yêu cầu mở.`
        : `Đã kiểm tra ${result.code}: ${statusLabels[result.status].toLowerCase()}.`)
      setUncertain(false)
      setSnapshot(previous => previous ? { ...previous, tables: previous.tables.map(item => item.id === result.id ? result : item) } : previous)
    } catch {
      if (detailRequest.current === controller) setDetailError('Chưa đọc được trạng thái mới nhất. Kiểm tra kết nối rồi thử lại.')
    } finally {
      if (detailRequest.current === controller) setDetailLoading(false)
    }
  }

  const openSession = async () => {
    if (!selected || opening || mutation.current || detailLoading || detailError || uncertain || loading || error
      || selected.status !== 'AVAILABLE' || selected.currentSession) return
    const table = selected
    const controller = new AbortController()
    mutation.current = controller
    setOpening(true)
    setNotice('')
    try {
      const response = await authPost(`/api/tables/${table.id}/sessions`, undefined, controller.signal)
      if (mutation.current !== controller) return
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (response.status === 409) {
        setNotice(`${table.code}: bàn đang phục vụ hoặc chờ dọn, không thể mở thêm phiên.`)
        await selectTable(table)
      } else if (response.status === 404) {
        setDetailError('Không tìm thấy bàn này. Vui lòng tải lại danh sách bàn.')
      } else {
        if (!response.ok) throw new Error('Open failed')
        const result: Table = await response.json()
        if (!validTable(result) || result.id !== table.id || !result.currentSession) throw new Error('Invalid response')
        if (mutation.current !== controller) return
        setSelected(result)
        setSnapshot(previous => previous ? { ...previous, tables: previous.tables.map(item => item.id === result.id ? result : item) } : previous)
        setNotice(`Đã mở phiên phục vụ cho ${table.code}.`)
      }
      if (mutation.current === controller) { setLoading(true); void loadTables() }
    } catch {
      if (mutation.current === controller) {
        setUncertain(true)
        setNotice(`Chưa xác định kết quả mở ${table.code}. Hãy kiểm tra trạng thái trước khi thao tác tiếp.`)
      }
    } finally {
      if (mutation.current === controller) { mutation.current = null; setOpening(false) }
    }
  }

  const tables = snapshot?.tables ?? []
  const areas = ['Tất cả', ...new Set(tables.map(table => table.area))]
  const visibleTables = tables.filter(table => area === 'Tất cả' || table.area === area)
  const available = tables.filter(table => table.status === 'AVAILABLE').length
  const occupied = tables.filter(table => table.status === 'OCCUPIED').length
  const cleaning = tables.filter(table => table.status === 'NEEDS_CLEANING').length
  const lastRead = snapshot
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .format(new Date(snapshot.observedAt))
    : null

  return (
        <main>
          <div className="page-heading">
            <div><p className="eyebrow">TỔNG QUAN NHÀ HÀNG</p><h1>Không gian phục vụ</h1><p className="intro">Một góc nhìn rõ ràng cho từng bàn trong quán.</p></div>
            <button className="refresh" onClick={refresh} disabled={loading || opening || detailLoading}>
              <span aria-hidden="true">↻</span> {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>

          <section className="summary" aria-label="Tổng quan bàn">
            <div className="summary-item"><span>Tổng số bàn</span><strong>{snapshot?.total ?? '—'}<small>BÀN</small></strong></div>
            <div className="summary-item"><span><i className="dot green" /> Bàn trống</span><strong>{snapshot ? available : '—'}<small>SẴN SÀNG</small></strong></div>
            <div className="summary-item"><span><i className="dot amber" /> Đang phục vụ</span><strong>{snapshot ? occupied : '—'}<small>CÓ KHÁCH</small></strong></div>
            <div className="summary-item"><span><i className="dot muted" /> Chờ dọn</span><strong>{snapshot ? cleaning : '—'}<small>BÀN</small></strong></div>
          </section>

          {error && <div className="error-banner" role="alert">
            <div><strong>Chưa kết nối được hệ thống quán.</strong><p>{snapshot ? 'Dữ liệu bên dưới là lần đọc thành công trước, có thể đã thay đổi.' : 'Kiểm tra backend và database rồi tải lại dữ liệu.'}</p></div>
            <button onClick={refresh} disabled={loading || opening || detailLoading}>Tải lại dữ liệu</button>
          </div>}

          {selected && <section ref={detailPanel} className="table-detail" aria-label={`Chi tiết ${selected.code}`} aria-busy={detailLoading || opening}>
            <div className="detail-heading"><div><p className="eyebrow">PHIÊN PHỤC VỤ</p><h2>{selected.code} · {selected.displayName}</h2></div><span>{statusLabels[selected.status]}</span></div>
            {detailLoading && <p role="status">Đang kiểm tra trạng thái bàn…</p>}
            {detailError && <p role="alert">{detailError}</p>}
            {notice && <p role="status">{notice}</p>}
            {!detailLoading && selected.currentSession && <dl className="session-info">
              <div><dt>Phiên hiện tại</dt><dd>#{selected.currentSession.id} · {selected.currentSession.status === 'OPEN' ? 'Đang mở' : 'Chờ thanh toán'}</dd></div>
              <div><dt>Người mở</dt><dd>{selected.currentSession.openedBy.displayName} ({selected.currentSession.openedBy.username})</dd></div>
              <div><dt>Thời gian mở</dt><dd>{dateTime(selected.currentSession.openedAt)}</dd></div>
            </dl>}
            {!detailLoading && !selected.currentSession && <p>{selected.status === 'AVAILABLE' ? 'Bàn trống, sẵn sàng đón lượt khách mới.' : 'Bàn chưa sẵn sàng để mở phiên mới.'}</p>}
            <div className="detail-actions">
              {selected.status === 'AVAILABLE' && !selected.currentSession && <button className="open-session" onClick={() => void openSession()} disabled={opening || detailLoading || !!detailError || uncertain || loading || error}>{opening ? 'Đang mở…' : `Mở phiên ${selected.code}`}</button>}
              <button className="refresh" disabled={opening || detailLoading} onClick={() => { void selectTable(selected); setLoading(true); void loadTables() }}>Kiểm tra trạng thái {selected.code}</button>
            </div>
          </section>}

          <section className="tables-section" aria-label="Danh sách bàn" aria-busy={loading}>
            <div className="section-toolbar">
              <div className="area-tabs" aria-label="Lọc khu vực">{areas.map(item => <button key={item} className={item === area ? 'active' : ''} aria-pressed={item === area} onClick={() => setArea(item)}>{item}</button>)}</div>
              <span className="legend"><i className="dot green" /> Bàn trống</span>
            </div>
            {!snapshot && loading && <p className="empty-state" role="status">Đang đọc danh sách bàn…</p>}
            {snapshot && tables.length === 0 && <p className="empty-state">Chưa có bàn trong database.</p>}
            <div className="table-grid">{visibleTables.map(table => (
              <article key={table.id} className={`table-card ${table.status.toLowerCase()}`} data-testid="table-card">
                <div className="card-top"><span className="table-code">{table.code}</span><span className="table-state"><i className={`dot ${table.status === 'AVAILABLE' ? 'green' : 'amber'}`} />{statusLabels[table.status]}</span></div>
                <div className="table-symbol" aria-hidden="true"><i /><span /><i /></div>
                <h2>{table.displayName}</h2><p>{table.area} <span>·</span> {table.seats} chỗ ngồi</p>
                <button className="table-action" aria-pressed={selected?.id === table.id} disabled={opening || uncertain} onClick={() => { setNotice(''); void selectTable(table) }}>{table.status === 'AVAILABLE' ? 'Mở bàn' : 'Xem bàn'} {table.code}</button>
              </article>
            ))}</div>
          </section>
          <footer className="content-footer">
            <span className="connection" role="status"><i className={`dot ${error ? 'amber' : snapshot ? 'green' : 'muted'}`} />{error ? 'Kết nối gián đoạn' : snapshot ? `Đã đọc dữ liệu lúc ${lastRead}` : 'Đang kết nối'}</span>
            <span>Chọn bàn để mở hoặc xem phiên phục vụ</span>
          </footer>
        </main>
  )
}

export default TablesPage
