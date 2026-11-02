import { useCallback, useEffect, useRef, useState } from 'react'
import MenuPage from './MenuPage'
import TablesPage from './TablesPage'
import LoginPage from './LoginPage'
import KitchenPage from './KitchenPage'
import ServingPage from './ServingPage'
import GuestPage from './GuestPage'
import { authPost, currentStaff, type Staff } from './auth'
import './App.css'

function App() {
  const [route, setRoute] = useState(window.location.hash || '#menu')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [checking, setChecking] = useState(true)
  const [notice, setNotice] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const version = useRef(0)
  const protectedPage = route === '#tables' || route === '#kitchen' || route === '#serving'
  const showTables = route === '#tables'
  const home = staff?.role === 'KITCHEN' ? '#kitchen' : staff?.role === 'MANAGER' ? '#serving' : '#tables'

  const expired = useCallback(() => {
    version.current++
    setStaff(null)
    setChecking(false)
    setSessionError('')
    setNotice('Phiên đăng nhập đã hết hạn hoặc quyền đã thay đổi. Vui lòng đăng nhập lại.')
  }, [])

  const checkSession = useCallback(async () => {
    const requestVersion = ++version.current
    try {
      const user = await currentStaff()
      if (requestVersion !== version.current) return
      setStaff(user)
      if (!user) setNotice('Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.')
      setSessionError('')
    } catch {
      if (requestVersion === version.current) {
        // Hide protected data until the server can confirm this session again.
        setStaff(null)
        setSessionError('Chưa kiểm tra được phiên đăng nhập. Kiểm tra kết nối rồi thử lại.')
      }
    } finally {
      if (requestVersion === version.current) setChecking(false)
    }
  }, [])

  useEffect(() => {
    const navigate = () => setRoute(window.location.hash || '#menu')
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  useEffect(() => { void Promise.resolve().then(checkSession) }, [checkSession])
  useEffect(() => {
    if (!protectedPage && route !== '#guest') return
    const resume = () => { if (document.visibilityState === 'visible') void checkSession() }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [protectedPage, route, checkSession])

  const loggedIn = async () => {
    version.current++
    const user = await currentStaff()
    if (!user) throw new Error('Chưa xác nhận được phiên đăng nhập. Vui lòng thử lại.')
    setStaff(user)
    setChecking(false)
    setNotice('')
    setSessionError('')
    window.location.hash = user.role === 'STAFF' ? '#tables' : user.role === 'MANAGER' ? '#serving' : '#kitchen'
  }
  const logout = async () => {
    version.current++
    setLoggingOut(true)
    setSessionError('')
    try {
      const response = await authPost('/api/auth/logout')
      if (!response.ok) throw new Error('Logout failed')
      version.current++
      setStaff(null)
      setNotice('Bạn đã đăng xuất. Phiên làm việc đã kết thúc.')
      window.location.hash = '#login'
    } catch {
      setSessionError('Chưa xác nhận được đăng xuất. Kiểm tra kết nối rồi bấm Đăng xuất lại.')
    } finally {
      setLoggingOut(false)
    }
  }

  const allowed = staff && ((showTables && staff.role === 'STAFF') || (route === '#kitchen' && staff.role === 'KITCHEN') || (route === '#serving' && ['STAFF', 'MANAGER'].includes(staff.role)))
  let content
  if (protectedPage && checking) content = <main><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>
  else if (protectedPage && sessionError && !staff) content = <main><div className="error-banner" role="alert"><p>{sessionError}</p><button onClick={() => void checkSession()}>Thử lại</button></div></main>
  else if ((protectedPage || route === '#login') && !staff) content = <LoginPage onLogin={loggedIn} notice={notice} />
  else if (protectedPage && !allowed) content = <main className="internal-page"><h1>Không có quyền truy cập</h1><p className="intro">Tài khoản này không có quyền vào khu vực được chọn.</p><a className="text-link" href={home}>Về khu vực làm việc</a></main>
  else if (route === '#serving' && staff) content = <ServingPage key={staff.username} staff={staff} onUnauthorized={expired} />
  else if (showTables) content = <TablesPage onUnauthorized={expired} />
  else if (route === '#kitchen') content = <KitchenPage onUnauthorized={expired} />
  else if (route === '#login' && staff) content = <main className="internal-page"><h1>Đã đăng nhập</h1><a className="text-link" href={home}>Về khu vực làm việc</a></main>
  else content = <MenuPage />

  if (route === '#guest') {
    if (checking) return <main><p role="status">Đang kiểm tra trình duyệt…</p></main>
    if (sessionError) return <main><p role="alert">{sessionError}</p><button onClick={() => void checkSession()}>Thử lại</button></main>
    if (staff) return <main><h1>Cần trình duyệt riêng cho khách</h1><p>Trình duyệt này đang đăng nhập {staff.displayName}. Mở cửa sổ ẩn danh/profile khác để gắn tablet, hoặc đăng xuất trước.</p><button className="primary-button" disabled={loggingOut} onClick={() => void logout()}>Đăng xuất</button><a className="text-link" href={home}>Về khu vực làm việc</a></main>
    return <GuestPage />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#menu" aria-label="Bếp nhà — trang chủ">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>Bếp nhà<small>KHÔNG GIAN NHÀ HÀNG</small></span>
        </a>
        <div className="sidebar-label">KHÔNG GIAN NHÀ HÀNG</div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a href="#menu" className={route === '#menu' ? 'nav-current' : ''} aria-current={route === '#menu' ? 'page' : undefined}><span aria-hidden="true">☷</span> Thực đơn</a>
          <a href="#tables" className={showTables ? 'nav-current' : ''} aria-current={showTables ? 'page' : undefined}><span aria-hidden="true">▦</span> Sơ đồ bàn</a>
          <a href="#kitchen" className={route === '#kitchen' ? 'nav-current' : ''} aria-current={route === '#kitchen' ? 'page' : undefined}><span aria-hidden="true">♨</span> Khu vực bếp</a>
          {staff && ['STAFF', 'MANAGER'].includes(staff.role) && <a href="#serving" className={route === '#serving' ? 'nav-current' : ''} aria-current={route === '#serving' ? 'page' : undefined}><span aria-hidden="true">↗</span> Mang món</a>}
          {!staff && <a href="#login" className={route === '#login' ? 'nav-current' : ''}>Đăng nhập nội bộ</a>}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon" aria-hidden="true">◌</span>
          <strong>Hương vị thân quen.</strong>
          <p>Món ngon mỗi ngày,<br />ấm lòng mỗi bữa.</p>
        </div>
        <div className="sidebar-footer"><span className="avatar">BN</span><div>{staff?.displayName ?? 'Nhà hàng demo'}<small>{staff ? (staff.role === 'STAFF' ? 'Nhân viên' : staff.role === 'MANAGER' ? 'Quản lý' : 'Bếp') : '30 bàn · 1 khu bếp'}</small></div></div>
        {staff && <button className="logout-button" disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Nhà hàng <span className="breadcrumb">/</span> <strong>{showTables ? 'Sơ đồ bàn' : route === '#kitchen' ? 'Bếp' : route === '#serving' ? 'Mang món' : route === '#login' ? 'Đăng nhập' : 'Thực đơn'}</strong></span>
          <span className="demo-tag">BẢN DEMO</span>
        </header>
        {sessionError && staff && <div className="error-banner" role="alert">{sessionError}</div>}
        {content}
      </div>
    </div>
  )
}

export default App
