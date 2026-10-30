# Frontend nhà hàng

React + TypeScript + Vite. Xem [README gốc](../README.md) để khởi động database/backend và cấu hình môi trường Windows.

Tại thư mục này: `npm.cmd ci`, `npm.cmd run dev`; mở http://127.0.0.1:5173. Vite chỉ bind localhost và proxy `/api` sang backend ở BACKEND_PORT trong `.env` gốc. Không đặt thông tin database vào biến VITE_.

Kiểm tra: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`. Với UI/API đã chạy, `npm.cmd run test:e2e` kiểm tra Chromium; cài browser lần đầu bằng `npm.cmd exec playwright install chromium`. E2E_BASE_URL mặc định 5173, có thể đặt thành địa chỉ jar 8080.

Trang chủ đọc menu từ `/api/menu`; `/#tables` đọc sơ đồ bàn từ `/api/tables`. Nhóm món, món, giá, đường dẫn ảnh, khả năng bán và dữ liệu bàn đều lấy từ API. Ảnh SVG mẫu đóng gói ở `public/menu-images`; font dùng system. Menu có tải/rỗng/lỗi, thử lại và cảnh báo snapshot cũ. Chưa có giỏ/gửi món hoặc quyền phiên.
