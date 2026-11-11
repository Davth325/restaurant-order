import { useEffect, useRef, useState } from 'react'
import MenuPage, { type MenuItem } from './MenuPage'
import { api, jsonPost } from './auth'
import './GuestPage.css'
import CancellationPanel from './CancellationPanel'

type Session = { id: number; tableCode: string; tableName: string; status: 'OPEN' | 'CHECKOUT_PENDING' }
type CartLine = { menuItemId: number; name: string; quantity: number; expectedPriceVnd: number; optionIds: number[]; note: string }
type Pending = { requestKey: string; items: CartLine[] }
type Batch = { id: number; requestKey: string; createdAt: string; totalVnd: number; netTotalVnd?: number; items: { id: number; menuItemId: number; name: string; quantity: number; unitPriceVnd: number; note: string; status: string; excludedQuantity?: number; progress?: { queued: number; preparing: number; ready: number; pickedUp?: number; served?: number; cancelled?: number } }[] }
const money = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
const storageKey = (id: number) => `guest-pending:${id}`
function clearPendingStorage() {
  for (const key of Object.keys(localStorage)) if (key.startsWith('guest-pending:')) localStorage.removeItem(key)
}
async function detail(response: Response) {
  const body = await response.json().catch(() => ({})) as { detail?: string; message?: string; code?: string }
  return { message: body.detail || body.message || 'Chưa thực hiện được. Vui lòng thử lại.', code: body.code }
}

export default function GuestPage({ staffOrder }: { staffOrder?: { sessionId: number; username: string } }) {
  const root = staffOrder ? '/api/staff' : '/api/guest'
  const pendingKey = (id: number) => staffOrder ? `staff-order-pending:${staffOrder.username}:${id}` : storageKey(id)
  const [session, setSession] = useState<Session | null>(null)
  const [code, setCode] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const [orders, setOrders] = useState<Batch[]>([])
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [stale, setStale] = useState(false)
  const running = useRef(false)
  const sessionRef = useRef<Session | null>(null)
  const acceptSession = (value: Session | null) => { sessionRef.current = value; setSession(value) }

  const checked = async (response: Response) => {
    // A generic 403 can be a CSRF rejection, which does not revoke device authority and
    // must not discard an earlier uncertain attempt. Only explicit guest denial clears it.
    const problem = response.status === 403 ? await detail(response.clone()) : null
    if (response.status === 401 || (response.status === 403 && ['SESSION_INACTIVE', 'WRONG_SESSION'].includes(problem?.code ?? ''))) {
      if (!staffOrder) clearPendingStorage()
      acceptSession(null); setCart([]); setOrders([]); setPending(null); setReview(false)
      throw new Error('Quyền tablet đã hết hiệu lực. Vui lòng nhờ nhân viên gắn lại.')
    }
    return response
  }
  const readOrders = async (current: Session) => {
    const response = await checked(await api(`${root}/sessions/${current.id}/orders`))
    if (!response.ok) throw new Error('Chưa tải được món đã gọi. Dữ liệu hiển thị có thể đã cũ; hãy thử lại.')
    const result: Batch[] = await response.json()
    setOrders(result); setStale(false)
  }
  const complete = (current: Session, batch: Batch, attempt: Pending) => {
    if (batch.requestKey !== attempt.requestKey || batch.items.length !== attempt.items.length || batch.items.some((item, index) => {
      const line = attempt.items[index]
      return item.menuItemId !== line.menuItemId || item.quantity !== line.quantity || item.unitPriceVnd !== line.expectedPriceVnd || item.note !== line.note
    })) throw new Error('Biên nhận khác nội dung đang chờ. Giữ nguyên lượt gửi và nhờ nhân viên kiểm tra.')
    localStorage.removeItem(pendingKey(current.id))
    setPending(null); setCart([]); setReview(false)
    setOrders(previous => [...previous.filter(item => item.id !== batch.id), batch].sort((a, b) => a.id - b.id))
    setMessage(`Đã nhận đợt #${batch.id}. Các món đang chờ bếp.`)
  }
  const lookup = async (current: Session, attempt: Pending) => {
    const response = await checked(await api(`${root}/sessions/${current.id}/orders/by-key/${attempt.requestKey}`))
    if (response.status === 404) return false
    if (!response.ok) throw new Error('Chưa kiểm tra được kết quả gửi. Giữ nguyên lượt gửi và thử kiểm tra lại.')
    complete(current, await response.json() as Batch, attempt)
    return true
  }

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await api(staffOrder ? `${root}/sessions/${staffOrder.sessionId}` : '/api/guest/session')
        if (!active) return
        if (response.status === 401 || response.status === 403) { if (!staffOrder) clearPendingStorage(); setMessage(staffOrder ? 'Phiên đăng nhập hoặc quyền gọi thay đã hết. Hãy đăng nhập lại.' : 'Nhờ nhân viên tạo mã cho đúng bàn rồi nhập bên dưới.'); return }
        if (!response.ok) throw new Error('Chưa kiểm tra được tablet. Kiểm tra kết nối và tải lại trang.')
        const current: Session = await response.json()
        if (!active) return
        acceptSession(current)
        const saved = localStorage.getItem(pendingKey(current.id))
        let attempt: Pending | null = null
        if (saved) {
          attempt = JSON.parse(saved) as Pending
          if (!attempt || typeof attempt.requestKey !== 'string' || !Array.isArray(attempt.items)) throw new Error('Dữ liệu lượt gửi cần được kiểm tra. Vui lòng gọi nhân viên.')
          setPending(attempt); setCart(attempt.items); setReview(true)
        }
        await readOrders(current)
        if (attempt && !await lookup(current, attempt)) setMessage('Chưa thấy lượt gửi trước. Bấm Kiểm tra và thử gửi lại để dùng cùng khóa.')
      } catch (error) { if (active) { setStale(true); setMessage((error as Error).message) } }
      finally { if (active) setBusy(false) }
    })()
    return () => { active = false }
    // Initial hydration reads the device credential from the server; never from URL/local storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bind = async () => {
    if (running.current) return
    running.current = true; setBusy(true); setMessage('')
    try {
      const response = await jsonPost('/api/guest/pairing', { code: code.trim() })
      if (!response.ok) throw new Error((await detail(response)).message)
      const current: Session = await response.json()
      clearPendingStorage()
      acceptSession(current); setCode(''); setCart([]); setOrders([]); setPending(null); setReview(false)
      setMessage(`Đã gắn với ${current.tableCode}. Hãy kiểm tra đúng bàn trước khi gọi món.`)
      await readOrders(current)
    } catch (error) { setMessage((error as Error).message) }
    finally { running.current = false; setBusy(false) }
  }
  const add = (item: MenuItem) => {
    if (busy || pending || review || session?.status !== 'OPEN') return
    setMessage('')
    setCart(previous => {
      const index = previous.findIndex(line => line.menuItemId === item.id && line.expectedPriceVnd === item.priceVnd)
      if (index < 0) return previous.length < 30 ? [...previous, { menuItemId: item.id, name: item.name, quantity: 1, expectedPriceVnd: item.priceVnd, optionIds: [], note: '' }] : previous
      return previous.map((line, i) => i === index ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line)
    })
  }
  const submit = async () => {
    if (!session || running.current || (!pending && !review)) return
    const current = session
    const attempt = pending ?? { requestKey: crypto.randomUUID(), items: cart }
    running.current = true; setBusy(true); setMessage('')
    try {
      // Persist before sending: reload/timeout must never allocate a fresh key for this attempt.
      localStorage.setItem(pendingKey(current.id), JSON.stringify(attempt))
      setPending(attempt)
      if (pending && await lookup(current, attempt)) return
      const response = await checked(await jsonPost(`${root}/sessions/${current.id}/orders`, attempt))
      if (response.ok) { complete(current, await response.json() as Batch, attempt); return }
      const problem = await detail(response)
      if ([400, 409].includes(response.status) && problem.code !== 'IDEMPOTENCY_CONFLICT') {
        localStorage.removeItem(pendingKey(current.id)); setPending(null); setReview(false)
      }
      setMessage(problem.message)
    } catch (error) {
      if (!sessionRef.current) { setMessage((error as Error).message); return }
      setMessage('Chưa xác định kết quả gửi. Đang kiểm tra lại với hệ thống…')
      try {
        if (!await lookup(current, attempt)) setMessage('Chưa thấy đợt gọi. Kiểm tra và thử gửi lại sẽ dùng cùng khóa, không tạo lượt gửi mới.')
      } catch (lookupError) { setMessage((lookupError as Error).message) }
    } finally { running.current = false; setBusy(false) }
  }
  const refresh = async () => {
    if (!session || running.current) return
    running.current = true; setBusy(true)
    try { await readOrders(session); if (pending) await lookup(session, pending) }
    catch (error) { setStale(true); setMessage((error as Error).message) }
    finally { running.current = false; setBusy(false) }
  }
  const updatePrices = async () => {
    if (running.current || pending) return
    running.current = true; setBusy(true)
    try {
      const response = await api('/api/menu')
      if (!response.ok) throw new Error('Chưa tải được giá mới. Vui lòng thử lại.')
      const menu: { categories: { items: MenuItem[] }[] } = await response.json()
      const items = menu.categories.flatMap(category => category.items)
      setCart(previous => previous.map(line => {
        const item = items.find(value => value.id === line.menuItemId)
        return item ? { ...line, name: item.name, expectedPriceVnd: item.priceVnd } : line
      }))
      setReview(false); setMessage('Đã cập nhật giá giỏ. Món hết/không còn bán cần được xóa; hãy xem lại trước khi gửi.')
    } catch (error) { setMessage((error as Error).message) }
    finally { running.current = false; setBusy(false) }
  }
  const total = cart.reduce((sum, line) => sum + line.quantity * line.expectedPriceVnd, 0)
  const validCart = cart.length > 0 && cart.every(line => Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 20) && Number.isSafeInteger(total)
  const locked = busy || !!pending || review || session?.status !== 'OPEN'

  return <div className="guest-page">
    <header className="guest-header"><a className="brand" href={staffOrder ? '#tables' : '#guest'}>{staffOrder ? 'Gọi thay khách · Nhân viên' : 'Bếp nhà · Tablet khách'}</a><span>{session ? `${session.tableCode} · ${session.tableName} · Phiên #${session.id}` : 'Chưa gắn bàn'}</span></header>
    <main className="guest-tools">
      {message && <p className="guest-message" role="status">{message}</p>}
      {!session && staffOrder ? <section className="guest-panel"><a href="#tables">Về sơ đồ bàn / đăng nhập lại</a></section> : !session ? <section className="guest-panel"><h1>Gắn tablet vào bàn</h1><p>Dùng trình duyệt riêng cho khách. Không giao trình duyệt đang đăng nhập nhân viên cho khách.</p><form onSubmit={event => { event.preventDefault(); void bind() }}><label>Mã ghép từ nhân viên<input value={code} onChange={event => setCode(event.target.value)} maxLength={32} autoComplete="off" spellCheck={false} /></label><button className="open-session" disabled={busy || !code.trim()}>Gắn tablet</button></form><a href="#login">Khu vực nhân viên</a></section> : <>
        {session.status !== 'OPEN' && <p role="alert">Phiên đang chờ thanh toán, không thể gọi thêm.</p>}
        <section className="guest-panel" aria-label="Giỏ món"><h1>{review ? 'Xem lại trước khi gửi' : 'Giỏ món của bàn'}</h1><p>Mỗi lần xác nhận tạo một đợt gọi. Menu hiện chưa có tùy chọn món. Tạm tính chưa phải hóa đơn.</p>
          {cart.length === 0 && <p>Chọn món từ thực đơn bên dưới.</p>}
          {cart.map((line, index) => <div className="cart-line" key={`${line.menuItemId}:${index}`}><strong>{line.name} · {money(line.expectedPriceVnd)}/suất</strong><label>Số lượng {line.name}<input type="number" min="1" max="20" disabled={locked} value={line.quantity} onChange={event => setCart(previous => previous.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label><label>Ghi chú {line.name}<textarea maxLength={300} disabled={locked} value={line.note} onChange={event => setCart(previous => previous.map((item, i) => i === index ? { ...item, note: event.target.value } : item))} /></label><span>{money(line.quantity * line.expectedPriceVnd)}</span><button disabled={locked} onClick={() => setCart(previous => previous.filter((_, i) => i !== index))}>Xóa {line.name}</button></div>)}
          <p className="cart-total">Tạm tính đợt này: <strong>{money(total)}</strong></p><div className="guest-actions">
            {pending ? <button className="open-session" disabled={busy} onClick={() => void submit()}>Kiểm tra và thử gửi lại</button> : review ? <><button disabled={busy} onClick={() => setReview(false)}>Sửa giỏ</button><button className="open-session" disabled={busy || !validCart || session.status !== 'OPEN'} onClick={() => void submit()}>Xác nhận gửi món</button></> : <><button className="open-session" disabled={busy || !validCart || session.status !== 'OPEN'} onClick={() => setReview(true)}>Xem lại đợt gọi</button><button disabled={busy || !cart.length} onClick={() => void updatePrices()}>Cập nhật giá giỏ</button></>}
          </div>{pending && <p>Lượt gửi chưa xác nhận · {pending.requestKey}. Giỏ đang khóa để tránh gửi thành hai đợt.</p>}
        </section>
        <section className="guest-panel" aria-label="Món đã gọi"><div className="detail-heading"><h2>Món đã gọi từ hệ thống</h2><button disabled={busy} onClick={() => void refresh()}>Tải lại món đã gọi</button></div>{stale && <p role="alert">Chưa đọc được dữ liệu mới. Danh sách có thể đã cũ.</p>}<p className="cart-total">Tạm tính cả phiên: <strong>{money(orders.reduce((sum, batch) => sum + (batch.netTotalVnd ?? batch.totalVnd), 0))}</strong></p>{orders.length === 0 && <p>Chưa có đợt gọi được hiển thị.</p>}{orders.map(batch => <article className="order-batch" key={batch.id}><h3>Đợt #{batch.id} · {money(batch.netTotalVnd ?? batch.totalVnd)}</h3>{batch.netTotalVnd !== undefined && batch.netTotalVnd !== batch.totalVnd && <p>Đợt gốc: {money(batch.totalVnd)} · đã trừ các suất được duyệt hủy/loại.</p>}<p>{new Date(batch.createdAt).toLocaleString('vi-VN')}</p>{batch.items.map(item => <p key={item.id}>{item.quantity} × {item.name} · {money(item.unitPriceVnd)} · {item.progress ? `${item.progress.ready + (item.progress.pickedUp ?? 0) + (item.progress.served ?? 0)}/${item.quantity} đã xong · ${item.progress.ready} chờ mang · ${item.progress.pickedUp ?? 0} đang mang · ${item.progress.served ?? 0} đã phục vụ · ${item.progress.preparing} đang làm · ${item.progress.queued} chờ bếp` : 'Chờ bếp'}{!!item.progress?.cancelled && ` · ${item.progress.cancelled} đã hủy`}{!!item.excludedQuantity && ` · ${item.excludedQuantity} loại khỏi tạm tính`}{item.note && ` · ${item.note}`}</p>)}</article>)}</section>
      </>}
    </main>
    {session && !staffOrder && <CancellationPanel sessionId={session.id} onChanged={() => void refresh()} />}
    {session && <MenuPage onAdd={add} disabled={locked} />}
  </div>
}
