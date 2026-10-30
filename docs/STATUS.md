# Trạng thái hiện tại

Cập nhật: 30/10/2026 — đã khởi động lại môi trường, lưu bộ khung đầu tiên lên GitHub và kiểm chứng CI Linux thành công.

## Khởi động lại và lưu phiên bản — 30/10/2026

- Đã mở Docker Desktop, PostgreSQL healthy; giữ nguyên .env và volume dữ liệu cũ. `dev.ps1 build` chạy lại thành công: npm ci/lint/frontend build và 6 test PostgreSQL/Testcontainers đạt.
- Đã cấu hình origin `https://github.com/Davth325/restaurant-order.git`. `git ls-remote` thành công và repository đích trống trước khi đưa source lên; Git Credential Manager có tài khoản Davth325, không đưa credential vào source/log.
- Đã rà 68 file source dự kiến commit: không có .env, cache/dependency/build/log/data database; không tìm thấy mật khẩu local, mẫu token hoặc private key. Gradle Wrapper jar và frontend lockfile nằm trong source; bản jar ứng dụng không đưa lên Git.
- Preview đã chạy lại tại http://127.0.0.1:8080; health UP, API đọc đủ B01–B30; 3 test Chromium đạt.
- Đã commit/push bộ khung: `8260b1cd67b8cce961438a9813eabfab762eb2da` — `feat: save initial M1 restaurant ordering scaffold`. Nhánh main theo dõi origin/main. GitHub API xác nhận 68 file, không có file cần loại trừ; SHA cây source trong commit GitHub khớp cây local `827fc33af5f36ccfcb3f95f09cca6d8a7f751330`.
- [GitHub Actions lần đầu](https://github.com/Davth325/restaurant-order/actions/runs/41062661036) đã completed/success cho commit bộ khung 8260b1c: frontend lint/typecheck/build, Gradle build/test PostgreSQL, khởi động jar/Compose và browser flow trên Ubuntu đều đạt. Đây là bằng chứng CI cho commit đó; các run do tag hoặc commit tài liệu sau đó cần xem trạng thái riêng, không tự coi đã đạt.
- Đã tạo và push [tag v0.1.0-m1](https://github.com/Davth325/restaurant-order/tree/v0.1.0-m1) trỏ đúng commit bộ khung `8260b1cd67b8cce961438a9813eabfab762eb2da`. Tag là mốc source đầu tiên, không gồm .env hoặc dữ liệu PostgreSQL local. `git ls-remote` xác nhận main và tag có trên GitHub; bản cập nhật STATUS này được lưu bằng commit tài liệu riêng.

## Đã làm

- Git local ở đúng thư mục restaurant-order, nhánh main; tiến độ remote/commit/push hiện tại ở mục ngày 30/10 phía trên. .gitignore bỏ qua .env, cache/dependency, build, log và file quản lý process.
- Backend Java 21, Spring Boot, Gradle Wrapper có checksum; API `GET /api/tables` đọc PostgreSQL qua JPA/service read-only, health kiểm tra database. Hibernate validate; Flyway V1 tạo schema và repeatable seed riêng profile demo tạo B01–B30.
- React + TypeScript + Vite: hiển thị dữ liệu thật, lọc khu vực, tải lại, báo lỗi mạng và đánh dấu snapshot cũ. UI đóng gói cùng jar; Vite proxy dùng cho phát triển. Chỉ bind localhost, chưa có quyền/phiên hay mutation nghiệp vụ.
- PostgreSQL Compose khóa image/digest, volume bền vững và healthcheck; .env.example chỉ có mẫu giả. Initialize-Dev tạo mật khẩu local ngẫu nhiên trong .env bị Git bỏ qua.
- Script Windows khởi động/dừng/build/test và preview nền; đã thử cả Windows PowerShell cho Start-Preview/status. README/AGENTS ghi lệnh thật; DEVELOPMENT ghi phiên bản. D005/D006 xác nhận theo yêu cầu thực hiện M1, D017/D018 ghi lựa chọn triển khai.
- `.github/workflows/ci.yml` cấu hình frontend checks/build, Gradle/PostgreSQL tests và Playwright với jar trên Linux; kết quả mới ở mục ngày 30/10 phía trên.

## Bằng chứng kiểm tra thực tế

Các lệnh tại root trừ khi ghi khác:

| Lệnh / kiểm tra | Kết quả quan sát |
| --- | --- |
| `scripts/dev.ps1 db`, `scripts/dev.ps1 status` | PostgreSQL 18.6 healthy, host 127.0.0.1:54329; Docker Engine Linux 29.9.2, Compose 5.6.1 ngoài sandbox |
| `scripts/Use-Java21.ps1` rồi Wrapper `--version`, `-q javaToolchains` trong backend | Gradle 9.8.2; Launcher/Daemon JVM 21.0.12; JDK 17 vẫn được tìm thấy và giữ nguyên |
| `scripts/dev.ps1 build` | Exit 0: npm ci, lint, TypeScript/Vite build, Gradle clean build, 6 integration test PostgreSQL/Testcontainers đạt |
| `scripts/dev.ps1 backend`, `scripts/dev.ps1 frontend` | bootRun kết nối PostgreSQL, Flyway validate 2 migration; Vite ở 5173 proxy API trả 30 bàn |
| `scripts/Start-Preview.ps1` | Jar có frontend khởi động, health UP; UI HTTP 200, API total=30, B01–B30 ở 8080 |
| `E2E_BASE_URL=http://127.0.0.1:8080` rồi `scripts/dev.ps1 test` | Exit 0: 6 test backend, typecheck/lint và 3 test Chromium đạt |
| `npm run test:e2e` trong frontend với E2E_BASE_URL=5173 | Cả 3 test đạt qua Vite: dữ liệu thật/lọc khu, lỗi mạng/phục hồi/snapshot cũ, tablet 768 × 1024 không tràn ngang |
| Dừng PostgreSQL bằng `dev.ps1 stop`, chạy lại `dev.ps1 db` | API trả HTTP 503 khi database dừng; marker kiểm tra còn sau container recreate với cùng volume. Marker đã dọn; API phục hồi đúng 30 bàn |
| `Stop-Preview.ps1`, Ctrl+C bootRun/Vite, Start-Preview lại | Đã dừng/chạy lại backend thành công; Flyway không seed trùng, dữ liệu 30 bàn còn |
| Dựng từ `.work/clean-source` | Sao chép 68 file source theo danh sách Git không bị ignore, không có .env/node_modules/build; npm ci + lint/typecheck/build và Gradle clean build/6 test đều đạt. Dùng cache tải dependency sẵn có, không dùng output build cũ; chưa phải clone từ GitHub |
| Chromium chụp `.work/m1-desktop.png` | Đã xem ảnh desktop; render 30 bàn, không ghi nhận pageerror JavaScript |

Integration test kiểm tra profile mặc định không seed, demo đủ 30 bàn, API phản ánh bản ghi vừa commit, no-store, health, ràng buộc code/seats và từ chối POST. Test dùng container tạm riêng, không thao tác database demo.

## Lỗi đã xử lý và rà soát

- Spring Initializr trả lỗi với hậu tố RELEASE; tải thành công bằng phiên bản chuẩn 4.1.2. Testcontainers dùng digest-only để nhận đúng image PostgreSQL.
- Đã cách ly profile default của test schema khỏi SPRING_PROFILES_ACTIVE=demo từ .env phát triển; không bỏ qua test.
- Đã sửa lint/frontend typecheck; Windows khóa native module/jar khi server đang chạy được xử lý bằng dừng server trước build và ghi rõ README.
- Rà API chỉ đọc/bind localhost, schema constraints, migration/seed không reset dữ liệu, lỗi database/snapshot cũ và file cấu hình. Chưa có code tiền/đơn/thanh toán để đánh giá chống trùng/đồng thời; đó là nghiệm thu M2–M4, không coi M1 đã đáp ứng.
- Kiểm tra cuối 68 file source: không có lỗi khoảng trắng, liên kết Markdown nội bộ hỏng hoặc lỗi parse PowerShell. Không tìm thấy mật khẩu local vừa tạo trong source không bị ignore hoặc bundle frontend; .env/cache/build đúng là bị Git bỏ qua. Health UP, UI HTTP 200 và API B01–B30 vẫn hoạt động lúc bàn giao.

## Đang chạy để chủ dự án thử

- Preview UI + API: http://127.0.0.1:8080; PostgreSQL healthy trên 127.0.0.1:54329.
- Vite và bootRun thử nghiệm đã dừng. Dừng preview/database: `scripts/Stop-Preview.ps1`, rồi `scripts/dev.ps1 stop`. Chạy lại theo README.

## Chưa kiểm tra / bước tiếp

- Kết quả push/CI của M1.6 theo mục ngày 30/10 phía trên; không coi local build là bằng chứng Linux/GitHub Actions đã đạt.
- Chưa có đăng nhập, phiên bàn, gửi món, bếp hoặc thu tiền. Chốt D008/D009 và loại menu trước M2; các luật tiền/hủy/giảm trước module tương ứng.
- Chưa thử LAN/WAN, iPad/Safari thật, máy chủ tại quán, tải 30 phiên đồng thời, HTTPS, backup/restore. Kiến trúc tại quán vẫn là đề xuất.
- Tiếp theo: chủ dự án thử ứng dụng đang chạy ở localhost:8080 và xem tag v0.1.0-m1 trên GitHub; sau đó giao M2 theo một lát cắt quyền/phiên/menu/gửi món được chốt riêng. M1.6 đã có bằng chứng GitHub Actions Linux cho commit bộ khung.
