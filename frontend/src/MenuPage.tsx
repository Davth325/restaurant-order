import { useCallback, useEffect, useRef, useState } from 'react'
import './MenuPage.css'

export type MenuItem = { id: number; name: string; priceVnd: number; imagePath: string; available: boolean }
type Category = { id: number; name: string; items: MenuItem[] }
type MenuSnapshot = { categories: Category[]; total: number; observedAt: string }

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function isMenuSnapshot(value: unknown): value is MenuSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as MenuSnapshot
  return Array.isArray(snapshot.categories) && Number.isSafeInteger(snapshot.total) &&
    Number.isFinite(Date.parse(snapshot.observedAt)) &&
    snapshot.categories.every(category => category && Number.isSafeInteger(category.id) &&
      typeof category.name === 'string' && Array.isArray(category.items) &&
      category.items.every(item => item && Number.isSafeInteger(item.id) && typeof item.name === 'string' &&
        Number.isSafeInteger(item.priceVnd) && item.priceVnd >= 0 && typeof item.available === 'boolean' &&
        typeof item.imagePath === 'string')) &&
    snapshot.total === snapshot.categories.reduce((total, category) => total + category.items.length, 0)
}

function DishImage({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false)
  const localImage = /^\/menu-images\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(item.imagePath)
  return failed || !localImage
    ? <div className="dish-image image-fallback" role="img" aria-label={`Chưa có ảnh ${item.name}`}>Ảnh món đang cập nhật</div>
    : <img className="dish-image" src={item.imagePath} alt={item.name} width="480" height="300" onError={() => setFailed(true)} />
}

export default function MenuPage({ onAdd, disabled = false }: { onAdd?: (item: MenuItem) => void; disabled?: boolean }) {
  const [snapshot, setSnapshot] = useState<MenuSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageAttempt, setImageAttempt] = useState(0)
  const activeRequest = useRef<AbortController | null>(null)

  const loadMenu = useCallback(() => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    void fetch('/api/menu', { signal: controller.signal, cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Menu unavailable')
        return response.json() as Promise<unknown>
      })
      .then(result => {
        if (!isMenuSnapshot(result)) throw new Error('Invalid menu snapshot')
        if (activeRequest.current === controller) {
          setSnapshot(result)
          setError(false)
          setImageAttempt(previous => previous + 1)
          setSelectedId(previous => result.categories.some(category => category.id === previous) ? previous : null)
        }
      })
      .catch(() => {
        if (activeRequest.current === controller) setError(true)
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (activeRequest.current === controller) setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadMenu()
    return () => {
      activeRequest.current?.abort()
      activeRequest.current = null
    }
  }, [loadMenu])

  const refresh = () => {
    setLoading(true)
    loadMenu()
  }

  const categories = snapshot?.categories ?? []
  const visibleCategories = categories.filter(category => selectedId === null || category.id === selectedId)
  const available = categories.reduce((count, category) => count + category.items.filter(item => item.available).length, 0)

  return (
    <main className="menu-page">
      <div className="page-heading">
        <div><p className="eyebrow">TỪ GIAN BẾP NHÀ</p><h1>Thực đơn hôm nay</h1><p className="intro">Chọn hương vị bạn yêu, tận hưởng bữa ăn cùng nhau.</p></div>
        <button className="refresh" onClick={refresh} disabled={loading}><span aria-hidden="true">↻</span> {loading ? 'Đang tải…' : 'Làm mới'}</button>
      </div>

      <div className="menu-note"><span aria-hidden="true">✳</span><div><strong>Một bữa ngon, một khoảng yên.</strong><p>Menu mẫu · Giá theo món · Ảnh minh họa</p></div><span className="menu-count">{snapshot ? `${snapshot.total} món · ${available} còn bán` : 'Đang kết nối'}</span></div>

      {error && <div className="error-banner" role="alert">
        <div><strong>Chưa tải được thực đơn từ hệ thống quán.</strong><p>{snapshot ? 'Thực đơn bên dưới là lần đọc thành công trước; giá và tình trạng còn bán có thể đã thay đổi.' : 'Chưa kết nối được dữ liệu. Vui lòng thử lại.'}</p></div>
        <button onClick={refresh} disabled={loading}>Tải lại thực đơn</button>
      </div>}

      <section aria-label="Thực đơn" aria-busy={loading}>
        {categories.length > 0 && <div className="area-tabs category-tabs" aria-label="Lọc nhóm món">
          <button className={selectedId === null ? 'active' : ''} aria-pressed={selectedId === null} onClick={() => setSelectedId(null)}>Tất cả</button>
          {categories.map(category => <button key={category.id} className={selectedId === category.id ? 'active' : ''} aria-pressed={selectedId === category.id} onClick={() => setSelectedId(category.id)}>{category.name}</button>)}
        </div>}
        {loading && <p className="menu-loading" role="status">{snapshot ? 'Đang cập nhật thực đơn…' : 'Đang tải thực đơn…'}</p>}
        {snapshot?.total === 0 && !loading && <p className="empty-state">Thực đơn chưa có món. Vui lòng quay lại sau.</p>}
        {snapshot && snapshot.total > 0 && visibleCategories.map(category => <section className="menu-category" key={category.id} aria-label={category.name}>
          <div className="category-heading"><h2>{category.name}</h2><span>{category.items.length} món</span></div>
          {category.items.length === 0 && <p className="empty-state">Nhóm này chưa có món.</p>}
          <div className="dish-grid">{category.items.map(item => <article className={`dish-card ${item.available ? '' : 'sold-out'}`} key={item.id} data-testid="menu-item">
            <div className="dish-visual"><DishImage key={`${imageAttempt}:${item.imagePath}`} item={item} /><span className={`dish-status ${item.available ? 'in-stock' : 'out-of-stock'}`}><i className={`dot ${item.available ? 'green' : 'amber'}`} />{item.available ? 'Còn bán' : 'Hết món'}</span></div>
            <div className="dish-details"><h3>{item.name}</h3><p className="dish-price">{money.format(item.priceVnd)}</p>{onAdd && <button className="open-session" disabled={disabled || !item.available || loading || error} onClick={() => onAdd(item)}>Thêm {item.name}</button>}</div>
          </article>)}</div>
        </section>)}
      </section>
      <footer className="content-footer">
        <span className="connection" role="status"><i className={`dot ${error ? 'amber' : snapshot ? 'green' : 'muted'}`} />{error ? 'Kết nối gián đoạn' : loading ? 'Đang kết nối hệ thống quán' : snapshot ? `Đã đọc thực đơn lúc ${time.format(new Date(snapshot.observedAt))}` : 'Chưa có dữ liệu'}</span>
        <span>{onAdd ? 'Giá được kiểm tra lại khi gửi món' : <a className="text-link" href="#guest">Gắn tablet để gọi món</a>}</span>
      </footer>
    </main>
  )
}
