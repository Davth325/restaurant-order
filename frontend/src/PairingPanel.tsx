import { useRef, useState } from 'react'
import { jsonPost } from './auth'

export default function PairingPanel({ sessionId, tableCode, onUnauthorized }: { sessionId: number; tableCode: string; onUnauthorized: () => void }) {
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const sending = useRef(false)
  const create = async () => {
    if (sending.current) return
    sending.current = true; setBusy(true); setPairing(null); setMessage('')
    try {
      const response = await jsonPost(`/api/staff/sessions/${sessionId}/pairing`)
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return }
      if (!response.ok) {
        const problem: { detail?: string } = await response.json()
        throw new Error(problem.detail || 'Chưa tạo được mã. Hãy kiểm tra trạng thái bàn rồi thử lại.')
      }
      setPairing(await response.json() as { code: string; expiresAt: string })
    } catch (error) { setMessage((error as Error).message || 'Chưa nhận được mã. Tạo lại mã sẽ thay mã chưa dùng trước đó.') }
    finally { sending.current = false; setBusy(false) }
  }
  return <div className="pairing-panel"><h3>Gắn tablet khách · {tableCode}</h3><p>Mở <a href="/#guest" target="_blank" rel="noreferrer">màn hình tablet khách</a> trên trình duyệt riêng/ẩn danh hoặc thiết bị khách. Cửa sổ mới cùng profile vẫn dùng chung đăng nhập, không được giao cho khách.</p><button className="open-session" disabled={busy} onClick={() => void create()}>{busy ? 'Đang tạo mã…' : `Tạo mã gắn tablet ${tableCode}`}</button>{message && <p role="alert">{message}</p>}{pairing && <><code aria-label="Mã ghép tablet">{pairing.code}</code><p>Mã dùng một lần, hết hạn lúc {new Date(pairing.expiresAt).toLocaleTimeString('vi-VN')}. Tạo mã mới thay mã chưa dùng trước đó.</p><p>Nhập mã trên màn hình khách và đối chiếu {tableCode}, phiên #{sessionId} trước khi giao tablet.</p></>}</div>
}
