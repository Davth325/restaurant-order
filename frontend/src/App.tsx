import { useEffect, useState } from 'react'
import MenuPage from './MenuPage'
import TablesPage from './TablesPage'
import './App.css'

function App() {
  const [showTables, setShowTables] = useState(window.location.hash === '#tables')
  useEffect(() => {
    const navigate = () => setShowTables(window.location.hash === '#tables')
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#menu" aria-label="Bếp nhà — trang chủ">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>Bếp nhà<small>KHÔNG GIAN NHÀ HÀNG</small></span>
        </a>
        <div className="sidebar-label">KHÔNG GIAN NHÀ HÀNG</div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a href="#menu" className={!showTables ? 'nav-current' : ''} aria-current={!showTables ? 'page' : undefined}><span aria-hidden="true">☷</span> Thực đơn</a>
          <a href="#tables" className={showTables ? 'nav-current' : ''} aria-current={showTables ? 'page' : undefined}><span aria-hidden="true">▦</span> Sơ đồ bàn</a>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon" aria-hidden="true">◌</span>
          <strong>Hương vị thân quen.</strong>
          <p>Món ngon mỗi ngày,<br />ấm lòng mỗi bữa.</p>
        </div>
        <div className="sidebar-footer"><span className="avatar">BN</span><div>Nhà hàng demo<small>30 bàn · 1 khu bếp</small></div></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Nhà hàng <span className="breadcrumb">/</span> <strong>{showTables ? 'Sơ đồ bàn' : 'Thực đơn'}</strong></span>
          <span className="demo-tag">BẢN DEMO</span>
        </header>
        {showTables ? <TablesPage /> : <MenuPage />}
      </div>
    </div>
  )
}

export default App
