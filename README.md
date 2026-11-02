# Ứng dụng gọi món nhà hàng

Bộ khung M1 tới bước **6.6 — nhận mang và xác nhận phục vụ**: Java 21 + Spring Boot + Gradle Wrapper, React + TypeScript + Vite, PostgreSQL + Flyway + Spring Security. Menu/30 bàn/phiên/đợt gọi lấy từ database thật. Nhân viên mở phiên, gắn tablet; khách gửi món chống trùng; bếp làm từng suất; nhân viên nhận mang/giao từng suất và quản lý giám sát trực tiếp. Chưa có đóng/dọn bàn, hủy hoặc thu tiền.

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

- Initialize tạo `.env` với mật khẩu local ngẫu nhiên; giữ giá trị đã có, bổ sung mật khẩu demo nếu thiếu. `.env.example` chỉ chứa mẫu giả; `.env` bị Git bỏ qua. Khi nâng bản, chạy lại Initialize trước khởi động để thêm cấu hình mới.
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
| `nhanvien` | Giá trị `DEMO_STAFF_PASSWORD` | Sơ đồ 30 bàn, mở/xem phiên |
| `bep` | Giá trị `DEMO_KITCHEN_PASSWORD` | Hàng đợi bếp, bắt đầu/xong từng suất |
| `nhanvien2` | Giá trị `DEMO_STAFF2_PASSWORD` | Nhân viên thứ hai để thử nhận mang đồng thời |
| `quanly` | Giá trị `DEMO_MANAGER_PASSWORD` | Giám sát phục vụ, trả lại suất có lý do |

Mật khẩu được sinh riêng trên máy, không có mật khẩu chung trong Git. Mở `.env` tại root để sao chép; không chia sẻ file này. Chỉ profile demo seed bốn tài khoản bằng Flyway (hai tài khoản mới từ 6.6), lưu BCrypt ở PostgreSQL; restart không reset. Sửa mật khẩu trong `.env` sau seed không thay mật khẩu tài khoản đã có; chưa có giao diện reset/quản trị (6.10).

1. Dùng cửa sổ trình duyệt thường đăng nhập `nhanvien`, cửa sổ ẩn danh hoặc profile trình duyệt khác đăng nhập `bep` để có cookie riêng. Hai tab cùng profile thường dùng chung phiên.
2. Nhân viên thấy 30 bàn; bếp vào khu vực bếp. Thử đổi `/#tables` và `/#kitchen` để thấy thông báo không có quyền khi sai vai trò.
3. Trong mỗi cửa sổ, mở trực tiếp `/api/tables` và `/api/kitchen/workspace`: vai trò đúng 200, sai 403. Cửa sổ chưa đăng nhập nhận 401 ở cả hai; `/api/menu` vẫn 200.
4. Bấm Đăng xuất rồi trở lại URL nội bộ hoặc gọi API: form đăng nhập/401, cửa sổ vai trò còn lại vẫn hoạt động. Thử sai mật khẩu để thấy lỗi chung, input mật khẩu được xóa.
5. Phiên hết sau 30 phút không có request dùng phiên. Để thử nhanh: dừng preview, đặt `$env:STAFF_SESSION_TIMEOUT='1m'`, khởi động preview lại, đăng nhập rồi chờ hơn 1 phút không tải dữ liệu; bấm Làm mới → yêu cầu đăng nhập lại. Dừng preview, `Remove-Item Env:STAFF_SESSION_TIMEOUT`, chạy preview lại để trả mặc định. Restart server cũng buộc đăng nhập lại.

Đăng xuất cần kết nối server; nếu báo chưa xác nhận được, nối lại rồi bấm Đăng xuất lần nữa. Cookie HttpOnly/SameSite Strict, CSRF áp dụng cả login/logout; HTTP localhost dùng `Secure=false`. Chưa mở LAN; trước dùng thật cần HTTPS và `SESSION_COOKIE_SECURE=true` theo ARCHITECTURE/OPERATIONS.

## Tự thử danh sách bàn và mở phiên — bước 6.3

Mở [sơ đồ bàn](http://127.0.0.1:8080/#tables), đăng nhập `nhanvien`; mật khẩu là `DEMO_STAFF_PASSWORD` trong `.env` local tại root. Tài khoản và volume cũ được giữ nguyên.

1. Kiểm tra 30 bàn B01–B30, lọc Khu A/B; tổng quan có Bàn trống, Đang phục vụ và Chờ dọn.
2. Chọn **Mở bàn B01** → kiểm tra khu **Chi tiết B01** → bấm **Mở phiên B01**. B01 chuyển Đang phục vụ; chi tiết có mã phiên, người mở và thời gian; B02 không đổi.
3. F5 rồi chọn **Xem bàn B01**: vẫn cùng phiên, không còn nút mở. Muốn kiểm tra trực tiếp lỗi mở lại: tại DevTools Console của cửa sổ nhân viên chạy đoạn dưới, kết quả phải là `409` và `TABLE_NOT_AVAILABLE`:

```javascript
const csrf = await (await fetch('/api/auth/csrf')).json();
const snapshot = await (await fetch('/api/tables')).json();
const table = snapshot.tables.find(t => t.code === 'B01');
const response = await fetch(`/api/tables/${table.id}/sessions`, {
  method: 'POST', headers: { [csrf.headerName]: csrf.token }
});
console.log(response.status, await response.json());
```

4. Thử đồng thời bằng hai cửa sổ/profile đã đăng nhập nhân viên, cùng chọn một bàn trống khác trước khi bấm Mở phiên. Một bên mở thành công, bên còn lại báo không thể mở thêm và đọc được phiên hiện tại. Kiểm tra tự động backend dùng hai tài khoản khác nhau, năm lượt tranh chấp trên PostgreSQL biệt lập.
5. Dừng/chạy preview theo mục dưới, đăng nhập lại và xem B01: cùng mã phiên/người/thời gian. Có thể dừng/chạy database bằng `dev.ps1 stop/db` với volume cũ. Restart làm mất **phiên đăng nhập**, không mất **phiên phục vụ**.
6. Đăng nhập `bep` ở cửa sổ riêng: không vào được bàn hoặc POST mở bàn (403 dù có CSRF); chưa đăng nhập là 401. Menu vẫn công khai.
7. Khi đang xem bàn, bật Offline trong DevTools rồi Làm mới để thấy cảnh báo snapshot cũ và khóa mở. Nếu mất phản hồi lúc gửi, UI báo chưa xác định; nối lại rồi **Kiểm tra trạng thái B01** trước thao tác tiếp. Ứng dụng không tự gửi lại POST.

Chỉ mở bàn bạn muốn giữ có khách để thử: chưa có đóng phiên/dọn bàn/reset dữ liệu. Không xóa volume để đưa bàn về trống. Bàn chờ dọn được hiển thị và chặn mở; chưa có thao tác chuyển về trống. Gắn tablet/gửi món theo mục 6.4 bên dưới. Hiện chỉ dùng trình duyệt trên máy này tại localhost, chưa cần thao tác trên tablet thật.

## Tự thử tablet khách và gửi món — bước 6.4

1. Mở [sơ đồ bàn](http://127.0.0.1:8080/#tables), đăng nhập `nhanvien` với `DEMO_STAFF_PASSWORD` trong `.env` local tại root. Chọn một bàn đang phục vụ hoặc mở phiên bàn trống; bấm **Tạo mã gắn tablet Bxx**. Mã dùng một lần trong 5 phút; tạo lại sẽ thay mã chưa dùng trước. Giữ mã trong phạm vi thiết bị khách, không đăng lên Git/chat/log.
2. Mở **cửa sổ ẩn danh hoặc profile trình duyệt khác**, tới [tablet khách](http://127.0.0.1:8080/#guest), nhập mã rồi Gắn tablet. Kiểm tra mã bàn và mã phiên trên đầu trang trước khi giao khách. Tab/cửa sổ thường cùng profile vẫn chia sẻ cookie nhân viên và sẽ bị chặn gắn; không giao phiên nhân viên cho khách.
3. Thêm Gỏi cuốn tôm, sửa số lượng thành 2, ghi chú; bấm **Xem lại đợt gọi** → kiểm tra tạm tính → **Xác nhận gửi món**. Danh sách Món đã gọi từ hệ thống hiển thị đợt, số lượng, ghi chú và Chờ bếp. F5 vẫn còn đơn; thêm món khác để tạo đợt tiếp theo. Giỏ chưa gửi chỉ giữ trong bộ nhớ; riêng lượt đã bấm gửi chưa rõ kết quả được giữ trên máy tới khi kiểm tra xong.
4. Bật Offline lúc gửi để thử mất kết nối. Giỏ khóa và giữ khóa gửi, UI tra lại kết quả. Nối lại, bấm **Kiểm tra và thử gửi lại**: luôn tra trước và dùng cùng khóa nếu cần POST lại. Reload lúc chưa xác định cũng giữ lượt gửi. Không xóa dữ liệu trình duyệt trong lúc này. Không tự tạo đợt mới để thay một đợt chưa rõ kết quả.
5. Để thử bàn thứ hai, tạo mã cho Bxx khác, mở **profile khác nữa hoặc trình duyệt khác**. Hai cửa sổ ẩn danh của cùng trình duyệt thường chia sẻ cookie, không đại diện hai tablet độc lập. Dùng hai phiên thật khác nhau rồi đối chiếu món mỗi bàn. Cookie khách không có quyền API nhân viên/bếp.
6. Menu mẫu chưa có tùy chọn; backend từ chối `optionIds` khác rỗng. Mỗi dòng 1–20 suất, ghi chú tối đa 300 ký tự, tối đa 30 dòng/đợt. Giá/tổng lấy từ server; giá đổi hoặc món hết trả lỗi và không lưu một phần. Dùng **Cập nhật giá giỏ**, sửa/xóa món cần thiết rồi xem lại trước khi gửi. Không có giao diện quản trị giá/hết món trong bước này.

Kiểm tra kỹ thuật giá giả, sửa ID phiên, lặp khóa và đồng thời nằm trong `GuestOrderIntegrationTests`. Để tự chạy luồng UI/API/database thật mà không tạo món thử vào volume demo:

```powershell
# Sau dev.ps1 db và dev.ps1 build; cần Chromium đã cài và cổng 8081 trống.
.\scripts\Verify-GuestOrdering.ps1
```

Script tạo database `verify_guest_<guid>` riêng, mở hai bàn/tablet, thử mất phản hồi/reload, restart jar và đối chiếu đúng 3 đợt/210.000đ trong database đó, sau đó dọn đúng database tạm. Không reset bàn/đơn demo. Bằng chứng và giới hạn ở STATUS. Quyền tablet có thời hạn tuyệt đối 12 giờ, tồn tại qua restart server, và bị từ chối ngay khi phiên bàn đóng ở backend; chưa có UI đóng phiên trong 6.4.

Chưa mở LAN/HTTPS nên **không cần tablet thật để nghiệm thu local**. Không dùng địa chỉ `127.0.0.1` trên tablet khác máy, vì nó trỏ về chính tablet. Thử tablet thật cần bước cấu hình LAN/HTTPS tin cậy và cookie Secure theo OPERATIONS, chưa nằm trong lần bàn giao này. Bếp và nhân viên nhận mang đã có theo mục 6.5/6.6 bên dưới.

## Tự thử màn hình bếp — bước 6.5

1. Mở http://127.0.0.1:8080/#kitchen trên browser/profile riêng, đăng nhập **bep**, mật khẩu **DEMO_KITCHEN_PASSWORD** trong .env local tại root. Giữ cửa sổ nhân viên và khách riêng cookie theo mục 6.4.
2. Khách gửi 3 suất cùng món có ghi chú. Bếp tự thấy đúng bàn, đợt, giờ/phút chờ, tên, 3 suất và ghi chú; không cần bấm tải lại. Đơn đã gửi ở 6.4 cũng có suất chờ làm, không phải gửi lại.
3. Chọn Bắt đầu làm ở suất 1 → Xác nhận xong ở suất 1. Dòng còn **1/3 đã xong · 2 chờ làm**. Khi hoàn thành toàn bộ suất của mọi món trong đợt, thẻ đợt tự rời **Đang xử lý**; bấm **Đã xong · chờ mang** để xem lại. Đợt khác của cùng bàn chưa xong vẫn hiện ở Đang xử lý. Không bấm thêm nếu thực tế chưa làm; các suất xong chờ nhân viên nhận mang theo mục 6.6.
4. F5 hoặc mở bếp ở browser/profile khác đăng nhập bep: cùng tiến độ. Hai màn hình cùng bấm đúng một suất không tăng số lượng. Khách bấm Tải lại món đã gọi để thấy tiến độ mới.
5. Thử DevTools → Network → Offline rồi Tải lại hàng đợi: có cảnh báo dữ liệu cũ, nút từng suất bị khóa. Bỏ Offline, tải lại: hiện trạng thái mới, không làm mất/đảo trạng thái. Chặn riêng /api/kitchen/events khi API còn tới được: có cảnh báo realtime và tải lại mỗi 15 giây.
6. Chưa cần iPad thật cho nghiệm thu local. Để nhìn bố cục, dùng DevTools 768×1024 hoặc 1024×768. Thiết bị khác máy chưa truy cập được vì localhost, LAN/HTTPS chưa cấu hình; không dùng 127.0.0.1 trên iPad để trỏ về máy tính.

Kiểm tra biệt lập không tạo món thử vào database demo: sau build/db và Chromium đã cài, chạy **.\scripts\Verify-Kitchen.ps1**. Script tự tạo/dọn DB tạm, kiểm tra hai bàn/hai bếp, realtime, 1/3, mất phản hồi, polling/reconnect và restart. Chạy tuần tự với Verify-GuestOrdering.ps1 vì dùng chung cổng 8081. Nhận mang theo mục 6.6 bên dưới.


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

- `backend/`: package `com.restaurant.order`; identity dùng Spring Security/PostgreSQL, `GET /api/menu` public; `GET /api/tables`, `GET /api/tables/{id}` và `POST /api/tables/{id}/sessions` yêu cầu STAFF (POST có CSRF); `GET /api/kitchen/workspace` yêu cầu KITCHEN; health kiểm tra database. Lỗi truy cập dữ liệu trả HTTP 503 với thông báo chung, không trả credential/stack trace.
- `frontend/`: UI tiếng Việt, font/ảnh biểu tượng local, không cần CDN. Dữ liệu cũ khi tải lại thất bại được đánh dấu có thể đã thay đổi; lần tải đầu lỗi không hiện bàn giả.
- `infra/compose.yaml`: PostgreSQL khóa phiên bản/digest, volume bền vững và healthcheck.
- `backend/src/main/resources/db/migration/V1__create_restaurant_tables.sql`: schema do Flyway quản lý; Hibernate chỉ validate.
- `backend/src/main/resources/db/demo/R__demo_tables.sql`: seed B01–B30, hai khu, 4 chỗ/bàn; chỉ chạy với profile `demo` trong `.env` local. Profile mặc định tạo schema, không seed. Chạy lại không reset trạng thái bàn đã có.
- `backend/src/main/resources/db/migration/V2__create_menu.sql`: schema nhóm/món; `db/demo/R__demo_menu.sql` thêm menu mẫu chỉ profile demo, không ghi đè bản ghi đã tồn tại. Ảnh SVG trong `frontend/public/menu-images/`, đường dẫn lưu trong database. API đọc mọi món kể cả hết món, không có chức năng sửa/gửi món.
- `backend/src/main/resources/db/migration/V3__create_staff_users.sql`: schema tài khoản; Java migration `identity/R__demo_staff.java` chỉ profile demo, lấy mật khẩu từ môi trường rồi băm trước khi INSERT, không ghi đè tài khoản có sẵn.
- `backend/src/main/resources/db/migration/V4__create_table_sessions.sql`: phiên phục vụ riêng bàn vật lý, người/thời gian mở, khóa ngoại và unique index giới hạn một phiên hoạt động/bàn. Mở phiên dùng transaction + row lock, không cần sửa seed 30 bàn cũ.
- `backend/src/main/resources/db/migration/V5__guest_devices_and_orders.sql`: mã ghép/credential khách chỉ lưu SHA-256, đợt/dòng món và snapshot giá; unique khóa gửi theo phiên. Module `ordering` kiểm tra quyền phiên/giá/số lượng và xử lý chống trùng; hợp đồng API ở ARCHITECTURE.
- `scripts/`: lệnh Windows; `.github/workflows/ci.yml`: cấu hình build/test trên GitHub; kết quả chạy thực tế ghi trong STATUS.

Repository: [Davth325/restaurant-order](https://github.com/Davth325/restaurant-order), nhánh `main`. Tag `v0.1.0-m1` dùng để đánh dấu bộ khung M1 đầu tiên. Không commit `.env`, dependency đã cài, log hay dữ liệu PostgreSQL. Kết quả lưu phiên bản và kiểm tra GitHub ở [STATUS](docs/STATUS.md).

Tài liệu nghiệp vụ: [DOMAIN](docs/DOMAIN.md), [TESTING](docs/TESTING.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [OPERATIONS](docs/OPERATIONS.md). Kế hoạch [M1](docs/tasks/M1-SCAFFOLD.md); 6.3 đã được người dùng thử OK; 6.4 sẵn sàng thử local, chưa hoàn thành toàn bộ M2. Kết quả thực chạy và trạng thái commit/push/CI duy trì ở STATUS. Bước tiếp là **6.5 — màn hình bếp**.

## Tự thử nhận mang và phục vụ — bước 6.6

Nhân viên chỉ có **Chờ mang** chung và **Đang mang** của chính mình; backend cũng chỉ trả đúng dữ liệu này, số đếm tính riêng. Chỉ quản lý có **Đã phục vụ** và các nút **Lịch sử**. Dùng nhanvien/nhanvien2 nhận hai suất khác nhau rồi đối chiếu từng cửa sổ và quanly, reload vẫn đúng phạm vi. Sau cập nhật, nhấn **Ctrl+F5 ở từng cửa sổ** và đăng nhập lại nếu cần để tải bố cục mới; không xóa dữ liệu trình duyệt khi còn thao tác chưa rõ kết quả.

Chạy Initialize-Dev một lần để thêm mật khẩu local cho hai tài khoản mới; build rồi Start-Preview như đầu README. Giữ volume và tài khoản cũ. Mở http://127.0.0.1:8080/#serving, đăng nhập nhanvien hoặc nhanvien2; dùng quanly trong profile riêng để giám sát. Mật khẩu tương ứng là DEMO_STAFF_PASSWORD / DEMO_STAFF2_PASSWORD / DEMO_MANAGER_PASSWORD trong .env tại root. Quản lý chỉ có quyền phục vụ ở bước này, chưa có quản trị hoặc quyền mở bàn.

1. Chuẩn bị một đợt 3 suất theo luồng 6.4; bep hoàn thành ít nhất 2 suất theo 6.5. Đơn demo đã xong từ trước cũng tự có trong Chờ mang, không cần gửi lại. Nhân viên thấy bàn, món, số suất và thời gian chờ tính từ lúc bếp xong.
2. Dùng hai browser/profile tách cookie đăng nhập nhanvien và nhanvien2, cùng mở Mang món. Hai người bấm Nhận mang đúng cùng một suất: một người nhận được; bên còn lại báo xung đột, đọc lại để thấy suất đã có người nhận. Hai tab cùng profile dùng chung tài khoản nên không đại diện hai nhân viên.
3. Người đã nhận mở Đang mang → đối chiếu bàn/món/suất và tên/giờ nhận → Đã giao suất N khi thực tế đã giao. Suất đó rời danh sách công việc nhân viên, quản lý thấy trong Đã phục vụ; các suất khác giữ tiến độ hiện tại. Nhân viên khác không nhận dữ liệu suất đang mang của bạn qua API serving.
4. Thử nhận nhầm suất chưa giao: chủ suất hoặc quanly vào Đang mang → Trả lại suất N → nhập lý do → Xác nhận trả lại. Suất về Chờ mang, còn thời gian bếp xong cũ. Đăng nhập quanly để xem Lịch sử suất N giữ người nhận, người trả và lý do; STAFF gọi thẳng API lịch sử cũng bị 403. Không trả suất đã phục vụ về hàng đợi trong 6.6.
5. F5 cả nhân viên và bếp: giữ đúng tiến độ/người/thời điểm. Đã phục vụ không quay về Chờ mang; bếp không có nút nấu lại cho suất đang mang/đã giao. Khách bấm Tải lại món đã gọi để thấy các số suất đã xong/chờ mang/đang mang/đã phục vụ, chỉ của phiên mình.
6. Mất kết nối rồi Tải lại món phục vụ: cảnh báo dữ liệu cũ và khóa nhận/giao. Nếu mất response lúc thao tác, giữ lượt gửi qua reload và bấm Kiểm tra và thử lại sau nối lại; luôn tra trước rồi retry đúng khóa/phiên bản nếu cần. Không xóa dữ liệu trình duyệt hoặc tạo lượt thay thế khi còn chưa xác định.

Kiểm tra UI/API/PostgreSQL thật và restart không dùng dữ liệu demo: chạy scripts/Verify-Serving.ps1 sau build/db, Chromium đã cài và cổng 8081 trống. Script tạo database verify_serving_<guid>, thử hai nhân viên bấm cùng suất, giao một phần, quản lý trả lại có lý do/lịch sử, mất response/reload, SSE/polling/offline và restart; đối chiếu 2 đợt/180.000đ/4 suất/2 SERVED/6 thao tác rồi dọn DB tạm. Chạy tuần tự với Verify-Kitchen và Verify-GuestOrdering vì cùng cổng.

Chỉ localhost; chưa cần tablet thật để thử. Safari/iPad, LAN/HTTPS, tải 30 bàn và vận hành tại quán chưa kiểm chứng. Bước tiếp: **6.7 — gọi thêm và ngoại lệ**. Commit/push/CI chờ người dùng thử và giao chốt.
