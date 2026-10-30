import { useState, type FormEvent } from 'react'
import { authPost } from './auth'

export default function LoginPage({ onLogin, notice }: { onLogin: () => Promise<void>; notice: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await authPost('/api/auth/login', new URLSearchParams({ username, password }))
      if (response.status === 401) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.')
      if (response.status === 403) throw new Error('Phiên xác thực đã thay đổi. Vui lòng đăng nhập lại.')
      if (!response.ok) throw new Error('Chưa đăng nhập được. Vui lòng thử lại.')
      await onLogin()
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== 'TimeoutError' && failure.name !== 'TypeError'
        ? failure.message : 'Không kết nối được hệ thống quán. Vui lòng thử lại.')
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  return <main>
    <section className="auth-card" aria-labelledby="login-heading">
      <p className="eyebrow">KHU VỰC NỘI BỘ</p>
      <h1 id="login-heading">Đăng nhập</h1>
      <p className="intro">Dùng tài khoản riêng của nhân viên hoặc bếp để vào khu vực làm việc.</p>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="username">Tên đăng nhập</label>
        <input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
        <label htmlFor="password">Mật khẩu</label>
        <input id="password" type="password" autoComplete="current-password" maxLength={72} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        <button className="primary-button" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <a className="text-link" href="#menu">Xem thực đơn</a>
    </section>
  </main>
}
