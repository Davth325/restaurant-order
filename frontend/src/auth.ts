export type Staff = { username: string; displayName: string; role: 'STAFF' | 'KITCHEN' | 'MANAGER' }

export async function api(path: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(10000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  return fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', signal })
}

export async function authPost(path: string, body?: URLSearchParams, signal?: AbortSignal) {
  const response = await api('/api/auth/csrf', { signal })
  if (!response.ok) throw new Error('Không kết nối được hệ thống quán. Vui lòng thử lại.')
  const csrf: { token: string; headerName: string } = await response.json()
  return api(path, { method: 'POST', headers: { [csrf.headerName]: csrf.token }, body, signal })
}

export async function jsonPost(path: string, body?: unknown) {
  const response = await api('/api/auth/csrf')
  if (!response.ok) throw new Error('Không kết nối được hệ thống quán.')
  const csrf: { token: string; headerName: string } = await response.json()
  return api(path, { method: 'POST', headers: { [csrf.headerName]: csrf.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export async function currentStaff(): Promise<Staff | null> {
  const response = await api('/api/auth/me')
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại.')
  const staff: Staff = await response.json()
  if (!staff.username || !staff.displayName || !['STAFF', 'KITCHEN', 'MANAGER'].includes(staff.role)) throw new Error('Phiên đăng nhập không hợp lệ.')
  return staff
}
