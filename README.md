# Ứng dụng gọi món nhà hàng

Bộ khung M1, menu mẫu và đăng nhập 6.2: Java 21 + Spring Boot + Gradle Wrapper, React + TypeScript + Vite, PostgreSQL + Flyway + Spring Security. Giao diện đọc **menu và 30 bàn demo từ database thật**, có bộ lọc, tải lại và thông báo khi mất kết nối. Nhân viên/bếp có tài khoản riêng và kiểm tra quyền tại backend. Chưa có mở phiên bàn, gọi món, hàng đợi bếp hoặc thu tiền.

Phạm vi sản phẩm giữ nguyên: demo 30 bàn, một bếp, QR do nhân viên kiểm tra và xác nhận. Kiến trúc máy chủ tại quán chạy qua LAN khi mất Internet vẫn là đề xuất; chưa kiểm chứng vận hành tại quán. [Phạm vi](docs/PRODUCT.md) · [Quyết định](docs/DECISIONS.md) · [Trạng thái thực tế](docs/STATUS.md).

## Chuẩn bị trên Windows

- JDK 21; giữ được JDK 17 cho dự án khác. Script tự tìm JDK 21; nếu chưa tìm thấy, đặt `$env:JDK21_HOME = 'đường dẫn JDK 21'`.
- Node.js 24.21.0, npm 11.19.0; [phiên bản và cách chọn Java](docs/DEVELOPMENT.md).
- Mở Docker Desktop và đợi Linux Engine chạy; `docker info` phải có `OSType: linux` và phần Server. Trong Codex, các lệnh mạng/Docker có thể cần chạy ngoài sandbox.
- Mở PowerShell tại thư mục chứa README này. Nếu Windows chặn script, mở một phiên cho công việc này bằng `powershell.exe -NoProfile -ExecutionPolicy Bypass`, rồi chạy các lệnh dưới. Không cần thay execution policy toàn máy.

Lần đầu cần Internet để tải dependency, Gradle và image. Cổng mặc định: ứng dụng 8080, Vite 5173, PostgreSQL 54329. Tất cả chỉ bind `127.0.0.1`; chưa cấu hình HTTPS/thiết bị để mở cho mạng quán.

## Chạy lần đầu — một địa chỉ cho cả UI và API

Chạy lần lượt tại **thư mục gốc**:

```powershell
.\scripts\Initialize-Dev.ps1
.\scripts\dev.ps1 db
.\scripts\dev.ps1 build
.\scripts\Start-Preview.ps1
```

- Initialize tạo `.env` với mật khẩu local ngẫu nhiên; giữ giá trị đã có, bổ sung hai mật khẩu demo nếu thiếu. `.env.example` chỉ chứa mẫu giả; `.env` bị Git bỏ qua. Khi nâng từ bản menu, chạy lại Initialize trước khởi động bản mới.
- `db` tạo PostgreSQL với volume và đợi healthy.
- `build` chạy `npm ci`, lint, TypeScript/Vite build, rồi Gradle `clean build`, gồm integration test với PostgreSQL/Testcontainers riêng. Docker Engine cần hoạt động.
- Start-Preview chạy jar ở nền, không mở cửa sổ terminal mới và đợi health UP.

Mở [ứng dụng](http://127.0.0.1:8080), [API menu](http://127.0.0.1:8080/api/menu), [API danh sách bàn](http://127.0.0.1:8080/api/tables) và [health](http://127.0.0.1:8080/actuator/health). Trang chủ hiển thị 6 món thuộc Khai vị/Món chính/Đồ uống, ảnh minh họa local, giá VND và Còn bán/Hết món (Bún chả Hà Nội mẫu hết món). Chọn nhóm để lọc; F5 vẫn thấy menu từ database. Chọn **Sơ đồ bàn**, đăng nhập nhân viên theo mục 6.2 dưới đây để xem B01–B30; chọn Khu A/B còn 15 bàn. API bàn yêu cầu cùng phiên đăng nhập nhân viên. Frontend không có danh sách món/bàn viết cứng.

Tự thử lỗi menu: mở DevTools → Network, bật Offline rồi bấm **Làm mới**; phải thấy lỗi và cảnh báo dữ liệu cũ. F5 lúc Offline không tải được trang là hành vi trình duyệt bình thường; kiểm tra lỗi tải đầu bằng chặn `/api/menu` rồi reload. Bỏ Offline/chặn request, bấm **Tải lại thực đơn** để phục hồi. Menu rỗng và lỗi ảnh có kịch bản tự động trong `frontend/tests/menu.spec.ts`, không cần xóa dữ liệu demo để thử.

Log preview: `.work/preview.log`, `.work/preview.err.log`. Process của preview được lưu ở `.work/preview-process.json`; Stop-Preview đối chiếu PID và thời điểm khởi động trước khi dừng.

## Tự thử đăng nhập — bước 6.2

Mở [đăng nhập](http://127.0.0.1:8080/#login). Menu vẫn xem công khai, sơ đồ bàn cần đăng nhập nhân viên.

| Tài khoản demo | Mật khẩu tại `.env` local | Sau đăng nhập |
| --- | --- | --- |
| `nhanvien` | Giá trị `DEMO_STAFF_PASSWORD` | Sơ đồ 30 bàn (chỉ xem) |
| `bep` | Giá trị `DEMO_KITCHEN_PASSWORD` | Khu vực bếp (chưa có hàng đợi) |

Mật khẩu được sinh riêng trên máy, không có mật khẩu chung trong Git. Mở `.env` tại root để sao chép; không chia sẻ file này. Chỉ profile demo seed hai tài khoản bằng Flyway, lưu BCrypt ở PostgreSQL; restart không reset. Sửa mật khẩu trong `.env` sau seed không thay mật khẩu tài khoản đã có; chưa có giao diện reset/quản trị (6.10).

1. Dùng cửa sổ trình duyệt thường đăng nhập `nhanvien`, cửa sổ ẩn danh hoặc profile trình duyệt khác đăng nhập `bep` để có cookie riêng. Hai tab cùng profile thường dùng chung phiên.
2. Nhân viên thấy 30 bàn; bếp vào khu vực bếp. Thử đổi `/#tables` và `/#kitchen` để thấy thông báo không có quyền khi sai vai trò.
3. Trong mỗi cửa sổ, mở trực tiếp `/api/tables` và `/api/kitchen/workspace`: vai trò đúng 200, sai 403. Cửa sổ chưa đăng nhập nhận 401 ở cả hai; `/api/menu` vẫn 200.
4. Bấm Đăng xuất rồi trở lại URL nội bộ hoặc gọi API: form đăng nhập/401, cửa sổ vai trò còn lại vẫn hoạt động. Thử sai mật khẩu để thấy lỗi chung, input mật khẩu được xóa.
5. Phiên hết sau 30 phút không có request dùng phiên. Để thử nhanh: dừng preview, đặt `$env:STAFF_SESSION_TIMEOUT='1m'`, khởi động preview lại, đăng nhập rồi chờ hơn 1 phút không tải dữ liệu; bấm Làm mới → yêu cầu đăng nhập lại. Dừng preview, `Remove-Item Env:STAFF_SESSION_TIMEOUT`, chạy preview lại để trả mặc định. Restart server cũng buộc đăng nhập lại.

Đăng xuất cần kết nối server; nếu báo chưa xác nhận được, nối lại rồi bấm Đăng xuất lần nữa. Cookie HttpOnly/SameSite Strict, CSRF áp dụng cả login/logout; HTTP localhost dùng `Secure=false`. Chưa mở LAN; trước dùng thật cần HTTPS và `SESSION_COOKIE_SECURE=true` theo ARCHITECTURE/OPERATIONS.

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

- `backend/`: package `com.restaurant.order`; identity dùng Spring Security/PostgreSQL, API chỉ đọc `GET /api/menu` public, `GET /api/tables` yêu cầu STAFF, `GET /api/kitchen/workspace` yêu cầu KITCHEN; health kiểm tra database. Lỗi truy cập dữ liệu trả HTTP 503 với thông báo chung, không trả credential/stack trace.
- `frontend/`: UI tiếng Việt, font/ảnh biểu tượng local, không cần CDN. Dữ liệu cũ khi tải lại thất bại được đánh dấu có thể đã thay đổi; lần tải đầu lỗi không hiện bàn giả.
- `infra/compose.yaml`: PostgreSQL khóa phiên bản/digest, volume bền vững và healthcheck.
- `backend/src/main/resources/db/migration/V1__create_restaurant_tables.sql`: schema do Flyway quản lý; Hibernate chỉ validate.
- `backend/src/main/resources/db/demo/R__demo_tables.sql`: seed B01–B30, hai khu, 4 chỗ/bàn; chỉ chạy với profile `demo` trong `.env` local. Profile mặc định tạo schema, không seed. Chạy lại không reset trạng thái bàn đã có.
- `backend/src/main/resources/db/migration/V2__create_menu.sql`: schema nhóm/món; `db/demo/R__demo_menu.sql` thêm menu mẫu chỉ profile demo, không ghi đè bản ghi đã tồn tại. Ảnh SVG trong `frontend/public/menu-images/`, đường dẫn lưu trong database. API đọc mọi món kể cả hết món, không có chức năng sửa/gửi món.
- `backend/src/main/resources/db/migration/V3__create_staff_users.sql`: schema tài khoản; Java migration `identity/R__demo_staff.java` chỉ profile demo, lấy mật khẩu từ môi trường rồi băm trước khi INSERT, không ghi đè tài khoản có sẵn.
- `scripts/`: lệnh Windows; `.github/workflows/ci.yml`: cấu hình build/test trên GitHub; kết quả chạy thực tế ghi trong STATUS.

Repository: [Davth325/restaurant-order](https://github.com/Davth325/restaurant-order), nhánh `main`. Tag `v0.1.0-m1` dùng để đánh dấu bộ khung M1 đầu tiên. Không commit `.env`, dependency đã cài, log hay dữ liệu PostgreSQL. Kết quả lưu phiên bản và kiểm tra GitHub ở [STATUS](docs/STATUS.md).

Tài liệu nghiệp vụ: [DOMAIN](docs/DOMAIN.md), [TESTING](docs/TESTING.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [OPERATIONS](docs/OPERATIONS.md). Kế hoạch [M1](docs/tasks/M1-SCAFFOLD.md); đăng nhập 6.2 và menu mẫu chưa hoàn thành toàn bộ M2. Người dùng đã thử đăng nhập thành công và giao chốt; kết quả commit/push/CI duy trì ở STATUS. Bước tiếp là 6.3 — danh sách bàn và mở phiên phục vụ.
