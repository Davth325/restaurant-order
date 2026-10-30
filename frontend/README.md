# Frontend nhà hàng

React + TypeScript + Vite. Xem [README gốc](../README.md) để khởi động database/backend và cấu hình môi trường Windows.

Tại thư mục này: `npm.cmd ci`, `npm.cmd run dev`; mở http://127.0.0.1:5173. Vite chỉ bind localhost và proxy `/api` sang backend ở BACKEND_PORT trong `.env` gốc. Không đặt thông tin database vào biến VITE_.

Kiểm tra: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`. Với UI/API đã chạy, `npm.cmd run test:e2e` kiểm tra Chromium; cài browser lần đầu bằng `npm.cmd exec playwright install chromium`. E2E_BASE_URL mặc định 5173, có thể đặt thành địa chỉ jar 8080.

Chỉ có màn hình đọc danh sách bàn từ API. Trạng thái bàn/đếm bàn không được giả lập trong frontend. Biểu tượng và font đều dùng tài nguyên local/system.
