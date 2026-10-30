import { useCallback, useEffect, useRef, useState } from 'react'


type Table = {
  id: number
  code: string
  displayName: string
  area: string
  seats: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'NEEDS_CLEANING'
}
type Snapshot = { tables: Table[]; total: number; observedAt: string }

const statusLabels = {
  AVAILABLE: 'Bàn trống',
  OCCUPIED: 'Đang phục vụ',
  NEEDS_CLEANING: 'Chờ dọn',
}

function TablesPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [area, setArea] = useState('Tất cả')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)

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
        if (!Array.isArray(result.tables) || result.total !== result.tables.length) {
          throw new Error('Invalid table snapshot')
        }
        if (activeRequest.current === controller) setSnapshot(result)
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
    }
  }, [loadTables])

  const refresh = () => {
    setLoading(true)
    setError(false)
    void loadTables()
  }

  const tables = snapshot?.tables ?? []
  const areas = ['Tất cả', ...new Set(tables.map(table => table.area))]
  const visibleTables = tables.filter(table => area === 'Tất cả' || table.area === area)
  const available = tables.filter(table => table.status === 'AVAILABLE').length
  const occupied = tables.filter(table => table.status === 'OCCUPIED').length
  const lastRead = snapshot
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .format(new Date(snapshot.observedAt))
    : null

  return (
        <main>
          <div className="page-heading">
            <div><p className="eyebrow">TỔNG QUAN NHÀ HÀNG</p><h1>Không gian phục vụ</h1><p className="intro">Một góc nhìn rõ ràng cho từng bàn trong quán.</p></div>
            <button className="refresh" onClick={refresh} disabled={loading}>
              <span aria-hidden="true">↻</span> {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>

          <section className="summary" aria-label="Tổng quan bàn">
            <div className="summary-item"><span>Tổng số bàn</span><strong>{snapshot?.total ?? '—'}<small>BÀN</small></strong></div>
            <div className="summary-item"><span><i className="dot green" /> Bàn trống</span><strong>{snapshot ? available : '—'}<small>SẴN SÀNG</small></strong></div>
            <div className="summary-item"><span><i className="dot amber" /> Đang phục vụ</span><strong>{snapshot ? occupied : '—'}<small>CÓ KHÁCH</small></strong></div>
            <div className="summary-item kitchen"><span>Khu bếp demo</span><strong>01<small>KHU BẾP</small></strong></div>
          </section>

          {error && <div className="error-banner" role="alert">
            <div><strong>Chưa kết nối được hệ thống quán.</strong><p>{snapshot ? 'Dữ liệu bên dưới là lần đọc thành công trước, có thể đã thay đổi.' : 'Kiểm tra backend và database rồi tải lại dữ liệu.'}</p></div>
            <button onClick={refresh} disabled={loading}>Tải lại dữ liệu</button>
          </div>}

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
              </article>
            ))}</div>
          </section>
          <footer className="content-footer">
            <span className="connection" role="status"><i className={`dot ${error ? 'amber' : snapshot ? 'green' : 'muted'}`} />{error ? 'Kết nối gián đoạn' : snapshot ? `Đã đọc dữ liệu lúc ${lastRead}` : 'Đang kết nối'}</span>
            <span>Demo chỉ xem bàn · Chưa mở phiên phục vụ</span>
          </footer>
        </main>
  )
}

export default TablesPage
