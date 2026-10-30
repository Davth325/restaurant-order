# Trạng thái hiện tại

Cập nhật: 30/10/2026 — người dùng đã thử menu và xác nhận hoạt động ổn; đã review, sửa lỗi phục hồi và kiểm tra lại. Bước tiếp theo: đăng nhập nhân viên/bếp. Bằng chứng M1/GitHub cũ bên dưới không đại diện cho thay đổi menu chưa push.

## Review và bàn giao menu — 30/10/2026

- **Hoàn thành:** menu mẫu database → API → UI đã được người dùng tự thử và xác nhận ổn. Review toàn bộ diff/schema/seed/backend/frontend/test; giữ API chỉ đọc, bind localhost, giá từ database, không sửa migration V1/V2 đã áp dụng hoặc dữ liệu demo.
- **Lỗi đã sửa:** ảnh lỗi không thử lại khi Làm mới cùng đường dẫn; một đường dẫn ảnh sai làm frontend loại cả menu; cảnh báo snapshot cũ biến mất trong lúc thử lại dù chưa đọc được dữ liệu mới. Sau sửa, ảnh có lượt thử lại, ảnh sai chỉ hiện placeholder và không được request, cảnh báo giữ tới khi snapshot mới thành công.
- **Bằng chứng tái hiện:** thêm 3 test hồi quy, chạy `npm.cmd run test:e2e -- --grep 'retries failed images|isolates an invalid image|keeps stale-menu'` trên bản trước sửa → cả 3 thất bại đúng lỗi nêu trên. Không bỏ/giảm assertion để làm test đạt.
- **Build sau sửa:** tại root, `scripts/Stop-Preview.ps1`, `scripts/dev.ps1 build` → exit 0; npm ci/lint, TypeScript/Vite build và Gradle clean build đạt. Báo cáo XML xác nhận **11 test PostgreSQL/Testcontainers**, 0 failures/errors (5 menu, 5 bàn, 1 schema/default profile), biệt lập database demo.
- **Browser sau sửa:** `scripts/Start-Preview.ps1`, rồi tại frontend đặt `E2E_BASE_URL=http://127.0.0.1:8080` và chạy `npm.cmd run test:e2e` → **13/13 Chromium đạt** (10 menu gồm 3 hồi quy mới, 3 bàn). Bao gồm menu thật/reload/giá/ảnh/trạng thái, lỗi/rỗng/thử lại, tablet dọc/ngang và màn hình nhỏ.
- **Review quyền/tiền/dữ liệu:** không có API ghi hoặc thay đổi đơn/thanh toán; seed không ghi đè giá/trạng thái; request cũ không cập nhật sau khi rời trang; mất kết nối không dựng menu giả. Không phát hiện thêm lỗi chặn bàn giao trong phạm vi menu chỉ đọc sau khi sửa và chạy lại kiểm tra.
- **Kiểm tra trước commit:** đối chiếu giá trị secret trong `.env` với source và bundle, quét mẫu token/private key và rà tên file; không phát hiện secret hoặc file môi trường thật trong nội dung đưa vào commit. `.env`, `.work`, dependency, build, log và dữ liệu database bị Git ignore; `.env.example` chỉ là mẫu giả. Kiểm tra lại trên Git index trước commit; `git diff --check` đạt. Đây là rà local theo mẫu/giá trị đã biết, không phải chứng nhận security audit toàn hệ thống.
- **Mốc lưu:** Git đã cấu hình local và origin; commit bàn giao có tiêu đề `feat: add database-backed sample menu`, gồm menu và phần review này. Xem SHA bằng `git log -1 --oneline`. Chưa push; CI Linux cho menu chưa chạy. Lịch sử CI M1 không được coi là bằng chứng cho menu.
- **Hạn chế còn lại:** chỉ demo local, chưa có đăng nhập/phân quyền; chưa thử Safari/iPad thật, LAN/WAN, tải đồng thời hoặc backup/restore. Ảnh là minh họa local, chưa có upload/quản trị menu, giỏ/gửi món/bếp/thu tiền. Không còn việc menu đang dở cần chặn bước tiếp.
- **Bước tiếp theo được người dùng giao:** đăng nhập nhân viên/bếp; triển khai ở task kế tiếp, gồm xác thực và phân quyền server phù hợp. Chưa bắt đầu tính năng đăng nhập trong commit menu này; vẫn giữ localhost trước khi có quyền và kiểm tra tương ứng.
- **Tự kiểm chứng:** preview tại http://127.0.0.1:8080; F5/menu nhóm/món hết vẫn hoạt động. Chặn request ảnh rồi Làm mới để thấy placeholder, bỏ chặn và Làm mới để phục hồi ảnh; sau lỗi API, giữ request thử lại ở trạng thái chờ để thấy cảnh báo dữ liệu cũ còn nguyên. Chi tiết lệnh ở README và test hồi quy ở `frontend/tests/menu.spec.ts`.

Mục menu ban đầu bên dưới giữ bằng chứng triển khai trước review (10 test browser lúc đó); kết quả mới nhất là 13 test ở mục này.

## Menu mẫu từ database — 30/10/2026

### Đã làm

- Đọc AGENTS, README, STATUS, PRODUCT, DOMAIN, ARCHITECTURE, UX, TESTING, OPERATIONS và DECISIONS; kiểm tra Git sạch trước sửa và code thực tế chỉ có API/UI bàn.
- Thêm Flyway **V2** tạo nhóm/món, khóa ngoại và ràng buộc giá `BIGINT` nguyên đồng không âm, trong giới hạn số nguyên JavaScript an toàn; giữ nguyên V1. Seed riêng profile demo tạo 3 nhóm, 6 món, gồm 1 món hết; chạy lại không ghi đè giá/tên/trạng thái hiện có.
- `GET /api/menu` đọc PostgreSQL qua module menu, transaction read-only cùng snapshot, DTO nhóm/món, tổng và thời điểm đọc; no-store, lỗi dữ liệu trả 503 chung; POST bị từ chối. Không thêm API quản trị hoặc mutation gọi món.
- Trang chủ mở thực đơn, nhóm lọc/tên/giá/đường dẫn ảnh/tình trạng lấy từ API; không có mảng món trong giao diện. 6 ảnh SVG minh họa local đóng gói cùng jar. Sơ đồ bàn được giữ ở `/#tables`, có điều hướng qua lại.
- UI có tải dữ liệu, không có món, lỗi mạng/HTTP, thử lại, cảnh báo giá/tình trạng snapshot cũ và placeholder khi ảnh lỗi; timeout request 10 giây. Bố cục tablet dọc/ngang, vùng chạm bộ lọc tối thiểu 44px; font tiêu đề dùng system để dấu tiếng Việt rõ trên máy thử.
- Cập nhật PRODUCT/DOMAIN/ARCHITECTURE/UX/TESTING/DECISIONS và README; giá VND theo món/ảnh minh họa là mặc định mẫu, chưa chốt menu thật, thuế/phí hoặc các luật gọi món.

### Bằng chứng kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả quan sát |
| --- | --- |
| `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` trong frontend | TypeScript đạt; lint không còn cảnh báo; Vite build đạt. Lint/build được chạy lại sau chỉnh font cuối cùng |
| Dot-source `scripts/Use-Java21.ps1`, rồi `backend/gradlew.bat --no-daemon clean build` tại backend | BUILD SUCCESSFUL; **11 test**, 0 lỗi: 5 menu, 5 bàn, 1 schema/default profile, đều với PostgreSQL/Testcontainers biệt lập |
| `backend/gradlew.bat --no-daemon bootJar` tại backend sau build frontend cuối | Đóng gói lại tài nguyên CSS/ảnh cuối cùng thành công; code Java không đổi sau 11 test. Kiểm thử browser chạy lại trên jar này |
| Các test menu PostgreSQL | Kiểm tra seed/thứ tự/no-store/giá/món hết; sửa bản ghi đã commit được API phản ánh qua nhiều request; chạy lại seed không reset/nhân đôi; menu không có món; giá âm/vượt số nguyên an toàn và nhóm không tồn tại bị từ chối; POST 405; mô phỏng relation không đọc được → 503 không lộ chi tiết |
| `scripts/Start-Preview.ps1` trên database demo có sẵn từ M1 | Migration/seed menu áp dụng thành công; health UP; API có 3 nhóm/6 món, vẫn giữ 30 bàn và volume cũ |
| `E2E_BASE_URL=http://127.0.0.1:8080`, `npm.cmd run test:e2e` trong frontend | **10 test Chromium đạt**: 7 menu và 3 bàn; dữ liệu/giá/ảnh/tình trạng đối chiếu API thật, reload, lọc, điều hướng, tải/rỗng/lỗi/thử lại/snapshot cũ, dữ liệu API sai/ảnh hỏng |
| Tablet 768 × 1024, 1024 × 768; màn hình nhỏ 375 × 812 | Các test menu không tràn ngang; bộ lọc có vùng chạm ≥44px. Hồi quy sơ đồ bàn 768 × 1024 vẫn đạt |
| Đọc menu → `Stop-Preview.ps1` → `Start-Preview.ps1` → đọc lại | JSON nhóm/món trước/sau restart giống nhau (ID, tên, giá, ảnh, khả năng bán); total=6, categories=3, health UP. Không xóa volume hoặc reset database |
| Chromium chụp `.work/menu-tablet.png`, `.work/menu-desktop.png` | Đã xem ảnh giao diện và chỉnh font tiếng Việt; không có pageerror JavaScript. Ảnh nằm trong thư mục Git ignore |

Đã xử lý các lỗi gặp trong quá trình chạy: sandbox không truy cập Docker/socket local nên lệnh Docker/preview/browser cần chạy ngoài sandbox; preview cũ khóa jar Windows (đã xác minh đúng command line của dự án trước khi dừng); lỗi generic overload trong assert test và cảnh báo React setState trong effect được sửa rồi chạy lại đạt. Không sửa test để bỏ qua lỗi nghiệp vụ.

Đã rà phạm vi quyền/tiền/đơn: chỉ thêm đọc menu local, giá từ database, không có thao tác tạo đơn/thanh toán cần chống trùng; seed bảo toàn bản ghi cũ. Request cũ bị hủy khi rời trang/tải lại, lỗi không dựng menu giả và snapshot cũ được cảnh báo. Chi tiết nghiệp vụ/kiến trúc ở DOMAIN/ARCHITECTURE.

### Đang chạy / tự thử / bước tiếp

- Preview UI + API tại http://127.0.0.1:8080; PostgreSQL demo được giữ nguyên. Mở trang chủ, thử ba nhóm món, kiểm tra Bún chả Hà Nội có nhãn Hết món, nhấn F5 và Làm mới; chọn Sơ đồ bàn để xem màn hình cũ. API đối chiếu tại `/api/menu`.
- Thử lỗi: DevTools Network → Offline rồi Làm mới; thấy cảnh báo dữ liệu cũ. Bỏ Offline, bấm Tải lại thực đơn để phục hồi. Lệnh khởi động/dừng và kiểm thử ở README.
- Không còn phần menu mẫu đang dở hoặc vướng mắc nghiệm thu local. Hạn chế và mốc commit sau review ở mục bàn giao phía trên; chưa push/chạy CI Linux cho menu.
- Người dùng đã thử menu ổn. Bước tiếp sau review là đăng nhập nhân viên/bếp; chưa thêm giỏ, quản trị menu, bếp hoặc thu tiền.

Các mục dưới đây ghi lịch sử bộ khung M1 trước menu; số test/khả năng trong các mục M1 chỉ áp dụng tại thời điểm đó.

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
- Menu mẫu chỉ đọc đã hoàn thành theo mục mới phía trên. Chưa có đăng nhập, phiên bàn, gửi món, bếp hoặc thu tiền. Chốt D008/D009 và loại menu thực tế trước phần gọi món M2; các luật tiền/hủy/giảm trước module tương ứng.
- Chưa thử LAN/WAN, iPad/Safari thật, máy chủ tại quán, tải 30 phiên đồng thời, HTTPS, backup/restore. Kiến trúc tại quán vẫn là đề xuất.
- Tiếp theo: đăng nhập nhân viên/bếp theo yêu cầu mới nhất sau khi người dùng thử menu ổn; phiên/gửi món được giao riêng sau đó. Tag v0.1.0-m1 và CI Linux đã ghi ở trên chỉ là mốc bộ khung, chưa gồm menu mẫu.
