# Ứng dụng gọi món nhà hàng

Bộ khung M1: Java 21 + Spring Boot + Gradle Wrapper, React + TypeScript + Vite, PostgreSQL + Flyway. Giao diện đọc **30 bàn demo từ database thật**, có lọc khu vực, tải lại và thông báo khi mất kết nối. Chưa có đăng nhập, phiên bàn, gọi món, bếp hoặc thu tiền.

Phạm vi sản phẩm giữ nguyên: demo 30 bàn, một bếp, QR do nhân viên kiểm tra và xác nhận. Kiến trúc máy chủ tại quán chạy qua LAN khi mất Internet vẫn là đề xuất; chưa kiểm chứng vận hành tại quán. [Phạm vi](docs/PRODUCT.md) · [Quyết định](docs/DECISIONS.md) · [Trạng thái thực tế](docs/STATUS.md).

## Chuẩn bị trên Windows

- JDK 21; giữ được JDK 17 cho dự án khác. Script tự tìm JDK 21; nếu chưa tìm thấy, đặt `$env:JDK21_HOME = 'đường dẫn JDK 21'`.
- Node.js 24.21.0, npm 11.19.0; [phiên bản và cách chọn Java](docs/DEVELOPMENT.md).
- Mở Docker Desktop và đợi Linux Engine chạy; `docker info` phải có `OSType: linux` và phần Server. Trong Codex, các lệnh mạng/Docker có thể cần chạy ngoài sandbox.
- Mở PowerShell tại thư mục chứa README này. Nếu Windows chặn script, mở một phiên cho công việc này bằng `powershell.exe -NoProfile -ExecutionPolicy Bypass`, rồi chạy các lệnh dưới. Không cần thay execution policy toàn máy.

Lần đầu cần Internet để tải dependency, Gradle và image. Cổng mặc định: ứng dụng 8080, Vite 5173, PostgreSQL 54329. Tất cả chỉ bind `127.0.0.1`; bản M1 chưa có phân quyền để mở cho mạng quán.

## Chạy lần đầu — một địa chỉ cho cả UI và API

Chạy lần lượt tại **thư mục gốc**:

```powershell
.\scripts\Initialize-Dev.ps1
.\scripts\dev.ps1 db
.\scripts\dev.ps1 build
.\scripts\Start-Preview.ps1
```

- Initialize tạo `.env` với mật khẩu local ngẫu nhiên; không ghi đè file đã có. `.env.example` chỉ chứa mẫu giả; `.env` bị Git bỏ qua.
- `db` tạo PostgreSQL với volume và đợi healthy.
- `build` chạy `npm ci`, lint, TypeScript/Vite build, rồi Gradle `clean build`, gồm integration test với PostgreSQL/Testcontainers riêng. Docker Engine cần hoạt động.
- Start-Preview chạy jar ở nền, không mở cửa sổ terminal mới và đợi health UP.

Mở [ứng dụng](http://127.0.0.1:8080), [API danh sách bàn](http://127.0.0.1:8080/api/tables) và [health](http://127.0.0.1:8080/actuator/health). Giao diện phải có B01–B30; chọn Khu A/B còn 15 bàn. Số bàn đến từ API, không có mảng 30 bàn giả trong frontend.

Log preview: `.work/preview.log`, `.work/preview.err.log`. Process của preview được lưu ở `.work/preview-process.json`; Stop-Preview đối chiếu PID và thời điểm khởi động trước khi dừng.

## Dừng và chạy lại

```powershell
# Tại thư mục gốc: dừng preview, sau đó database.
.\scripts\Stop-Preview.ps1
.\scripts\dev.ps1 stop

# Chạy lại bản đã build, không cần build lại:
.\scripts\dev.ps1 db
.\scripts\Start-Preview.ps1
```

`stop` dùng Compose down và **giữ volume** `restaurant-order_postgres_data`. Không dùng `down -v` nếu muốn giữ dữ liệu. Muốn cập nhật code: dừng preview và Vite trước, chạy `dev.ps1 build`, rồi Start-Preview. Trên Windows, Vite có thể khóa file native khi `npm ci`, Java có thể khóa jar khi build.

Nếu đổi POSTGRES_USER/DB/PASSWORD trong `.env` sau lần tạo database đầu, PostgreSQL không tự đổi tài khoản trong volume cũ. Giữ cấu hình khớp với volume hoặc thực hiện đổi tài khoản có kiểm soát; không xóa volume để sửa lỗi một cách mặc định.

## Phát triển với Vite tự cập nhật giao diện

Dừng preview để giải phóng cổng 8080. Giữ database chạy. Mở hai terminal PowerShell tại thư mục gốc:

```powershell
# Terminal 1
.\scripts\dev.ps1 backend
```

```powershell
# Terminal 2; nếu chưa build/cài dependency, chạy npm.cmd --prefix frontend ci trước.
.\scripts\dev.ps1 frontend
```

Mở [Vite](http://127.0.0.1:5173). `/api` được proxy tới backend; thông tin database không được đưa vào frontend. Nhấn **Ctrl+C ở từng terminal** để dừng backend/Vite, sau đó `dev.ps1 stop` nếu muốn dừng database. Có thể dùng `dev.ps1 jar` để chạy jar ở foreground thay cho Start-Preview; cũng dừng bằng Ctrl+C.

## Kiểm tra

```powershell
# Cài Chromium một lần, sau khi đã npm ci/build:
Push-Location frontend
npm.cmd exec playwright install chromium
Pop-Location

# Khi database và UI/API đang chạy ở 8080:
$env:E2E_BASE_URL = 'http://127.0.0.1:8080'
.\scripts\dev.ps1 test

# Kiểm tra container:
.\scripts\dev.ps1 status
```

Nếu đang dùng Vite, đổi E2E_BASE_URL thành `http://127.0.0.1:5173`. Test backend tự tạo PostgreSQL tạm biệt lập; không xóa/sửa database demo. Báo cáo backend ở `backend/build/reports/tests/test/index.html`; trace browser khi lỗi ở `frontend/test-results/`.

Các lệnh riêng, đã chạy trên Windows:

```powershell
# Tại gốc: chọn Java cho terminal, không đổi cấu hình toàn máy
. .\scripts\Use-Java21.ps1
Push-Location backend
.\gradlew.bat --version
.\gradlew.bat -q javaToolchains
.\gradlew.bat test
Pop-Location

Push-Location frontend
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
Pop-Location
```

## Cấu trúc và dữ liệu

- `backend/`: package `com.restaurant.order`, API chỉ đọc `GET /api/tables`, health kiểm tra kết nối database. Lỗi truy cập dữ liệu trả HTTP 503 với thông báo chung, không trả credential/stack trace.
- `frontend/`: UI tiếng Việt, font/ảnh biểu tượng local, không cần CDN. Dữ liệu cũ khi tải lại thất bại được đánh dấu có thể đã thay đổi; lần tải đầu lỗi không hiện bàn giả.
- `infra/compose.yaml`: PostgreSQL khóa phiên bản/digest, volume bền vững và healthcheck.
- `backend/src/main/resources/db/migration/V1__create_restaurant_tables.sql`: schema do Flyway quản lý; Hibernate chỉ validate.
- `backend/src/main/resources/db/demo/R__demo_tables.sql`: seed B01–B30, hai khu, 4 chỗ/bàn; chỉ chạy với profile `demo` trong `.env` local. Profile mặc định tạo schema, không seed. Chạy lại không reset trạng thái bàn đã có.
- `scripts/`: lệnh Windows; `.github/workflows/ci.yml`: cấu hình build/test trên GitHub; kết quả chạy thực tế ghi trong STATUS.

Repository: [Davth325/restaurant-order](https://github.com/Davth325/restaurant-order), nhánh `main`. Tag `v0.1.0-m1` dùng để đánh dấu bộ khung M1 đầu tiên. Không commit `.env`, dependency đã cài, log hay dữ liệu PostgreSQL. Kết quả lưu phiên bản và kiểm tra GitHub ở [STATUS](docs/STATUS.md).

Tài liệu nghiệp vụ: [DOMAIN](docs/DOMAIN.md), [TESTING](docs/TESTING.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [OPERATIONS](docs/OPERATIONS.md). Kế hoạch [M1](docs/tasks/M1-SCAFFOLD.md); bước tiếp sau M1 là chốt luật phiên/quyền và làm lát cắt M2.
