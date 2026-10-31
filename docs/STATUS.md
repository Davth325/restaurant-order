# Trạng thái hiện tại

Cập nhật: 31/10/2026 — người dùng đã thử OK bước 6.3 và bản sửa thanh bên laptop, yêu cầu kết thúc phiên. Review local hoàn tất; đang lưu commit/push và kiểm tra CI cho đúng bản 6.3. Bước tiếp: 6.4 — gắn tablet và khách gửi món.

## Chốt bàn giao bước 6.3 — 31/10/2026

- **Nghiệm thu:** người dùng xác nhận “đã test ok” sau bản sửa thanh bên, yêu cầu thực hiện các việc kết thúc phiên. Đây là xác nhận thử tay bản bàn giao, không suy rằng mọi ca quyền/đồng thời/mạng đã được người dùng thử riêng; các ca đó có bằng chứng tự động bên dưới.
- **Review cuối:** đọc lại nghiệp vụ/kiến trúc, code/migration/UI/test và workflow; không phát hiện lỗi chặn chốt về quyền, sai bàn, trùng phiên, transaction hoặc dữ liệu cũ/mất phản hồi. Không thay đổi code sau bản người dùng đã thử; không triển khai đóng/dọn/trả bàn trống hoặc bước 6.4 trong lần chốt này.
- **Kiểm tra local:** giữ bằng chứng thực chạy `dev.ps1 build` với 22 test PostgreSQL, lớp phiên 6/6 sau tăng cường chứng minh tranh chấp khóa, typecheck/lint/build frontend và 29/29 Chromium của jar cuối. Rà lại `.last-run.json` xác nhận passed, XML lớp phiên 0 failures/errors. Không ghi rằng đã chạy lại toàn bộ test ở lượt chốt nếu chỉ đối chiếu báo cáo; CI sau push sẽ kiểm tra sạch trên Linux.
- **Git/remote:** `git fetch origin` thành công, baseline local/origin cùng `eb012d455ba5c6287c8bd2b4c0b3d0b03a4fc362` (0 ahead/behind). GitHub API xác nhận default branch `main`, không bảo vệ nhánh, có quyền push; tiếp tục luồng main hiện có, không force push.
- **An toàn source:** `git diff --check` và `.work/scan-review.cjs` đạt; 107 file source cùng bundle/log preview không chứa giá trị secret local đã biết hoặc mẫu private key/GitHub token. `.env`, `.work`, dependency/build/test report bị ignore. Kiểm tra thêm Git index trước commit, không đưa dữ liệu PostgreSQL hoặc mật khẩu demo vào Git.
- **Lưu phiên bản/CI:** đang thực hiện theo yêu cầu người dùng; chỉ cập nhật SHA/run/kết luận sau khi quan sát kết quả thật. Các run 6.2/M1 cũ không được dùng làm bằng chứng 6.3.
- **Kết thúc local:** sau khi chốt GitHub, dừng managed preview và PostgreSQL Compose bằng script hiện có, giữ volume và các phiên người dùng đã mở; không tắt Docker Desktop toàn máy hoặc xóa dữ liệu. Lệnh khởi động lại ở README. Hạn chế Safari/iPad thật, LAN/HTTPS, tải toàn quán và backup/restore vẫn giữ nguyên; bước tiếp 6.4.

Các mục triển khai bên dưới ghi lại trạng thái tại thời điểm thử/chờ nghiệm thu; trạng thái bàn giao mới nhất là mục chốt này.

## Sửa thanh bên cho laptop sau khi người dùng thử — 31/10/2026

- Người dùng gửi ảnh thanh bên bị cắt phần dưới và yêu cầu sửa bố cục; câu hỏi về chờ dọn/trả bàn trống chỉ yêu cầu giải thích, không triển khai nghiệp vụ đó. Chỉ đổi CSS thanh bên, thêm test hồi quy và tài liệu; giữ mọi thay đổi 6.3 đang chờ chốt.
- Nguyên nhân: sidebar fixed không có vùng cuộn, nhiều khoảng cách/khối trang trí theo chiều rộng nhưng chưa thích ứng chiều cao; nội dung vượt vùng xem ở laptop/Windows scale/zoom nên nút Đăng xuất bị cắt. Không cần giảm zoom của người dùng để ứng dụng hoạt động.
- Sửa: sidebar `100dvh`, cuộn dọc độc lập, không co vùng bấm; chiều cao ≤760px ẩn khẩu hiệu trang trí và giảm khoảng cách, giữ điều hướng/tài khoản/Đăng xuất. Mobile vẫn header chiều cao tự nhiên trong luồng trang. Không thêm thư viện hoặc đổi backend/database/quyền.
- Tái hiện trước sửa: `E2E_BASE_URL=http://127.0.0.1:8080`, `npm.cmd --prefix frontend run test:e2e -- --grep 'short laptop|extreme height|mobile header'`: **2 thất bại, 1 đạt**. Ở 1366×600, đáy nút Đăng xuất vượt tới 669px; vùng xem cao 240px không thể focus/nhìn thấy nút.
- Sau sửa: `npm.cmd --prefix frontend run typecheck`, `run lint`, `run build` đạt; `backend/gradlew.bat -p backend --no-daemon bootJar` đạt; Stop/Start-Preview thành công. Chạy `npm.cmd --prefix frontend run test:e2e` trên jar mới: **29/29 Chromium đạt**, gồm 26 ca cũ và 3 hồi quy sidebar. Không chạy lại test backend vì chỉ sửa CSS/test UI; 22 test backend của 6.3 bên dưới là bằng chứng lần chạy trước.
- Kiểm tra vùng xem 1366×600, 1280×630, 1024×500, 853×420: menu/Đăng xuất ≥44px, nằm trong vùng nhìn trước/sau cuộn nội dung; 1024×240 cuộn sidebar và logout bằng bàn phím được; mobile 375×812 không tràn ngang/header quá cao. Đã xem ảnh `.work/sidebar-laptop.png` và `.work/sidebar-short.png`. Các kích thước CSS mô phỏng vùng xem thu nhỏ do scale/zoom, chưa thay thế thử trực tiếp cấu hình laptop/zoom của chủ dự án.
- `git diff --check` đạt; review thay đổi chỉ bố cục, không có mutation bàn/đơn/tiền. Preview đang chạy http://127.0.0.1:8080/#tables; dữ liệu hai bàn đang phục vụ do người dùng mở được giữ nguyên. Restart yêu cầu đăng nhập lại; dùng Ctrl+Shift+R để tải giao diện mới. Chưa commit/push/CI, tiếp tục chờ người dùng thử và giao chốt.

## Danh sách bàn và mở phiên phục vụ — 6.3, 31/10/2026

### Đã làm và phạm vi

- Đọc AGENTS/README/STATUS, PRODUCT/DOMAIN/ARCHITECTURE/UX/DECISIONS/TESTING/OPERATIONS; kiểm tra code và Git thực tế. Bắt đầu trên `main`, working tree sạch, HEAD `eb012d4` (tài liệu chốt 6.2); chức năng đăng nhập ở `9cd161c` đã có code/test và bằng chứng CI riêng bên dưới. Không lấy CI cũ làm bằng chứng cho 6.3. Giữ nhánh hiện tại, chưa commit/push theo yêu cầu chờ người dùng thử.
- Khởi động Docker Desktop và PostgreSQL Compose, giữ `.env`, tài khoản và volume cũ; dừng preview trước đóng gói. Không nâng dependency/stack hoặc mở LAN.
- B01–B30 đã có từ seed demo, không cần seed mới. Thêm **Flyway V4** tạo `table_session` riêng bàn vật lý, FK bàn/người mở, thời gian database và partial unique index một phiên hoạt động/bàn (`OPEN`/`CHECKOUT_PENDING`). Không sửa V1–V3/seed đã có; không tự tạo phiên cho bàn cũ.
- STAFF được GET danh sách/chi tiết và POST `/api/tables/{id}/sessions` với CSRF. Mở bằng row lock bàn + transaction, cập nhật trạng thái và insert phiên nguyên tử; actor lấy từ principal, thời gian từ PostgreSQL. Mở lại/chờ dọn 409 có mã lỗi; không có bàn 404; bếp 403, anonymous 401 khi CSRF hợp lệ; lỗi database 503 chung. Menu/bếp/quyền cũ giữ theo phạm vi đã có.
- UI 30 bàn, lọc khu, ba trạng thái trống/đang phục vụ/chờ dọn. Chọn bàn để đọc chi tiết mới rồi xác nhận mở; hiện mã phiên, người và thời gian. Khóa gửi trùng; xung đột đọc lại trạng thái; mất phản hồi báo chưa xác định, không tự POST lại. Cảnh báo snapshot cũ giữ trong lúc thử lại, lỗi không dựng bàn giả.
- Cập nhật DOMAIN (nghiệp vụ), DECISIONS D008/D021 (xác nhận tách bàn/phiên và lựa chọn kỹ thuật), ARCHITECTURE, UX, PRODUCT, TESTING, OPERATIONS, README và hướng dẫn AGENTS. Chưa có đóng/dọn bàn, tablet/credential khách, gửi món hoặc tiền trong bước này.

### Bằng chứng kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| `scripts/Initialize-Dev.ps1`, `scripts/dev.ps1 db` | Giữ cấu hình hiện có, Docker Linux và PostgreSQL healthy với volume cũ. Khởi động Docker/Gradle/preview/browser ngoài sandbox sau khi sandbox không chạy được Docker/Gradle loopback |
| `scripts/dev.ps1 build` | Exit 0: npm ci/lint, TypeScript/Vite build và Gradle **clean build**; **22 test PostgreSQL/Testcontainers** đạt (5 identity, 5 menu, 5 bàn cũ, 1 schema, 6 phiên mới), không bỏ test |
| `backend/gradlew.bat -p backend --no-daemon test --tests '*TableSessionIntegrationTests'` sau bổ sung chứng minh tranh chấp khóa | BUILD SUCCESSFUL, **6/6** đạt; mỗi một trong năm bàn có hai transaction thật cùng chờ khóa trước khi được thả, đúng một 201/một 409 và một phiên. Báo cáo XML cuối riêng lớp phiên có 0 failures/errors |
| Integration phiên với PostgreSQL và HTTP/cookie thật | B01 mở, B02 không đổi; không tin actor/time giả; mở lại 409 rõ ràng; bếp/anonymous/CSRF bị chặn; bàn chờ dọn/mất/đã có phiên bị từ chối; seed/Flyway chạy lại không reset/nhân đôi; unique index chặn OPEN và CHECKOUT_PENDING trùng; CLOSED giữ lịch sử; lỗi insert sau update rollback bàn và không lộ SQL/secret |
| `npm.cmd --prefix frontend run typecheck`, `run lint`, `run build`; sau chỉnh UI cuối chạy lại lint/build | Exit 0, lint không cảnh báo; build TypeScript/Vite đạt. Sau cùng đóng gói lại bằng `backend/gradlew.bat -p backend --no-daemon bootJar` và Start-Preview thành công |
| `E2E_BASE_URL=http://127.0.0.1:8080`, `npm.cmd --prefix frontend run test:e2e` trên jar UI cuối | **26/26 Chromium đạt**: 7 auth, 10 menu, 3 bàn cũ với API thật; 6 UI phiên mô phỏng response để kiểm tra xác nhận, xung đột, mất phản hồi/tra trạng thái, double-click/expiry, snapshot cũ, chờ dọn và bố cục. Không gọi các mock UI là test transaction |
| `.work/Verify-TableSessions.ps1` và `.work/verify-table-ui.cjs` (kiểm tra local, Git ignore) | Dùng database tạm riêng trên PostgreSQL phát triển và jar ở 8081: trình duyệt đăng nhập thật → mở B01 qua UI → API/database có phiên/người/thời gian, B02 không đổi; POST lặp 409, bếp 403; reload giữ nguyên. Dừng jar, restart PostgreSQL, chạy jar/login lại: JSON B01 khớp toàn bộ trước/sau. Dọn đúng database tạm; không mở/xóa phiên demo |
| 768×1024, 1024×768, 375×812 và ảnh `.work/session-*.png` | Luồng live và test UI không tràn ngang; nút chi tiết ≥44px. Đã xem ảnh tablet dọc và điện thoại, chữ/trạng thái/người/thời gian hiển thị đúng; không có pageerror trong luồng live |

### Review, giới hạn và bàn giao

- Đã review migration/service/controller/security hiện có, UI, test và diff về quyền/sai bàn/trùng phiên/rollback/mất kết nối. Một SQL đọc bàn+phiên giữ cùng snapshot; các giá trị ghi do server lấy, query tham số hóa; không có thay đổi giá/đơn/tiền. Kỳ vọng số migration của test tăng đúng một do V4, không giảm assertion nghiệp vụ. Không phát hiện lỗi chặn nghiệm thu local.
- `git diff --check` đạt. Script rà local `.work/scan-review.cjs` kiểm tra 106 file source (gồm file mới), bundle frontend và log preview: không thấy giá trị secret thật trong `.env`; quét mẫu private key/GitHub token không thấy kết quả. `.env`, `.work`, dependency/build/test report vẫn bị Git ignore; không đưa dữ liệu kiểm thử hoặc credential vào source. Đây là kiểm tra theo giá trị/mẫu đã biết, không phải audit bảo mật toàn hệ thống.
- Ứng dụng demo để thử tại **http://127.0.0.1:8080/#tables**, health UP; `nhanvien` dùng `DEMO_STAFF_PASSWORD`, `bep` dùng `DEMO_KITCHEN_PASSWORD` trong `.env` local tại root. Không chép mật khẩu vào source/tài liệu. B01 demo giữ trống để chủ dự án mở; hướng dẫn chi tiết/repeat 409/hai cửa sổ/restart ở README.
- Tự thử: đăng nhập nhân viên → Mở bàn B01 → Mở phiên B01 → xem người/thời gian; B02 giữ trống → F5 → Xem bàn B01 vẫn cùng phiên. Hai cửa sổ cùng chọn một bàn trống rồi mở: một thành công, một xung đột. Restart cần login lại nhưng giữ phiên phục vụ.
- **Đang chờ:** người dùng tự nghiệm thu và lời nhắn giao chốt commit/push/CI. Chưa chạy CI 6.3; CI 6.2 phía dưới chỉ áp dụng SHA cũ. Không còn phần code 6.3 đang dở cần chặn thử local.
- **Chưa kiểm chứng:** Safari/iPad thật, LAN/WAN/HTTPS, tải đủ 30 phiên đồng thời, máy tại quán, backup/restore; demo tiếp tục bind localhost. Thử hai nhân viên tranh chấp không thay cho thử tải toàn quán. Không cần thao tác trên tablet thật để nghiệm thu localhost này; 6.4 sẽ xử lý gắn tablet và khách gửi món.

Các mục phía dưới là lịch sử trước 6.3; những câu “chưa mở phiên” và số lượng test cũ áp dụng ở thời điểm ghi nhận đó.

## Chốt bước 6.2 và kiểm chứng CI GitHub — 30/10/2026

- **Xác nhận của người dùng:** đã tự thử và đăng nhập được, yêu cầu hoàn thiện và chốt. Không suy rằng người dùng đã thử tay mọi ca logout/CSRF/sai quyền/expiry; các ca đó có bằng chứng tự động bên dưới.
- **Review cuối:** đọc lại code identity/UI/migration/test, diff và workflow; không phát hiện lỗi chặn chốt trong phạm vi 6.2. Không thay đổi hành vi sau bản người dùng đã thử, không mở thêm chức năng 6.3/6.10. Báo cáo local còn xác nhận 16/16 PostgreSQL và 20/20 Chromium, typecheck/lint/build đạt; lệnh và phạm vi kiểm tra ở mục triển khai dưới đây.
- **Kiểm tra trước commit:** `git diff --cached --check` đạt; quét 100 file trong Git index theo secret thật trong `.env` và mẫu token/private key, không phát hiện giá trị nhạy cảm hoặc file môi trường/build/log/dependency. `.env`, `.work`, test-results và output build vẫn bị ignore. Không đưa mật khẩu demo thật vào Git.
- **Nhánh và quyền:** GitHub API xác nhận default branch `main`, nhánh không được bảo vệ, tài khoản có quyền push. `git fetch origin` xác nhận remote/local cùng baseline `befbd1730c97435fa36c5fff69a08097dfa59f15`; tiếp tục luồng main hiện có, không force push hoặc tạo PR không cần thiết.
- **Commit đã push:** [`9cd161cb84c760ea28f3acba84968b06d74e4979` — feat: add staff and kitchen session authentication](https://github.com/Davth325/restaurant-order/commit/9cd161cb84c760ea28f3acba84968b06d74e4979), 34 file thay đổi. `git push origin main` thành công, fast-forward `befbd17..9cd161c`; local và origin/main khớp sau push.
- **CI thực tế:** [Build and test — run 41079268240](https://github.com/Davth325/restaurant-order/actions/runs/41079268240), event `push`, `head_sha=9cd161cb84c760ea28f3acba84968b06d74e4979`, trạng thái **completed**, kết luận **success**. [Job verify 124143697550](https://github.com/Davth325/restaurant-order/actions/runs/41079268240/job/124143697550) và các bước frontend checks/build, backend clean build/PostgreSQL tests, chuẩn bị demo, chạy jar, browser flow, dừng database đều **success**; không bỏ hoặc giảm kiểm tra để làm xanh.
- **Phạm vi bằng chứng:** run trên áp dụng chính xác commit chức năng `9cd161c`, không lấy kết quả CI menu cũ làm bằng chứng. Bản ghi kết quả CI này được lưu và push bằng commit tài liệu riêng; không suy kết quả CI của commit tài liệu từ run chức năng.
- **Trạng thái bàn giao:** 6.2 đã chốt, không còn vướng mắc triển khai trong phạm vi này. Giữ giới hạn localhost/thiết bị thật/HTTPS ở dưới; CI Linux không thay thế thử Safari/iPad hoặc mạng quán. Bước tiếp là **6.3 — danh sách bàn và mở phiên phục vụ**; quản trị tài khoản vẫn để 6.10.

## Bước 6.2 — đăng nhập nhân viên/bếp, người dùng đã thử thành công

### Đã hoàn thành

- Đọc AGENTS/README và tài liệu sản phẩm/nghiệp vụ/kiến trúc/UX/quyết định/kiểm thử/vận hành; đối chiếu code thật. Bắt đầu trên `main`, cây làm việc sạch, HEAD `befbd17` sau commit menu `4300628`. STATUS ghi nhận CI menu thành công cho SHA cũ; không dùng ghi nhận đó làm bằng chứng CI của 6.2. Giữ nhánh và stack hiện có; commit/push/CI sau khi người dùng thử theo mục chốt phía trên.
- Thêm Spring Security bằng BOM hiện có, tài khoản PostgreSQL/BCrypt cost 12; Flyway **V3** thêm staff_user, không sửa V1/V2. Java migration `R__demo_staff` chỉ profile demo, lấy hai mật khẩu riêng từ môi trường, băm trước prepared INSERT, không ghi đè tài khoản đã có. Profile mặc định chỉ schema, không tài khoản demo.
- Phân quyền backend: STAFF xem API bàn, KITCHEN vào API khu vực bếp, `/auth/me` yêu cầu phiên; GET menu/health/UI công khai, API khác mặc định từ chối. Chưa cần MANAGER; không cấp quyền thu tiền/hủy/giảm hoặc quản trị. Quyền hiện có ghi ở DOMAIN, lựa chọn triển khai ở D020/ARCHITECTURE.
- Login/logout bằng session phía server, chống fixation, cookie HttpOnly/SameSite Strict/cookie-only; CSRF cả login/logout, token cũ không dùng lại sau login. API trả 401/403 JSON, lỗi thông tin đăng nhập chung không lộ credential/hash. Timeout mặc định 30 phút không request dùng phiên, restart buộc login lại, không mất tài khoản.
- UI form tiếng Việt, sai thông tin/mạng lỗi và thử lại, xóa input mật khẩu sau gửi; tự vào sơ đồ bàn hoặc khu vực bếp theo vai trò. Sai trang có báo từ chối quyền. Mất phiên trên tab đang xem bỏ dữ liệu nội bộ và mời login lại; kiểm tra khi quay lại tab. Logout mất mạng báo chưa xác nhận và cho thử lại.
- Menu công khai tiếp tục hoạt động. Sơ đồ bàn vẫn chỉ đọc; khu vực bếp chỉ là điểm vào được bảo vệ, chưa có hàng đợi món. Không mở rộng sang mở phiên/gọi món/tiền/quản trị tài khoản.
- Initialize-Dev giữ cấu hình/mật khẩu đã có, bổ sung DEMO_STAFF_PASSWORD/DEMO_KITCHEN_PASSWORD ngẫu nhiên vào `.env` bị Git ignore. Cập nhật README/AGENTS/PRODUCT/DOMAIN/ARCHITECTURE/UX/DECISIONS/TESTING/OPERATIONS.

### Bằng chứng kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| Trong frontend: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` | Exit 0, không cảnh báo lint; chạy lại sau chỉnh giao diện cuối |
| Tại root: dot-source `scripts/Use-Java21.ps1`, `backend/gradlew.bat -p backend --no-daemon clean build` | BUILD SUCCESSFUL, **16 test PostgreSQL/Testcontainers**: 5 identity, 5 menu, 5 bàn, 1 default schema; XML 0 failures/errors |
| `backend/gradlew.bat -p backend --no-daemon test` sau cô lập timeout ngắn vào đúng test hết hạn | BUILD SUCCESSFUL, 16 test đạt lại; không rút timeout của các ca khác |
| Test identity HTTP thật | Anonymous 401; đúng vai trò 200/sai vai trò 403; `/me` không lộ hash; sai thông tin/enabled=false bị chặn; BCrypt và seed không reset; thiếu CSRF/token cũ 403; session ID đổi khi login; phát lại cookie đã logout 401; hết hạn servlet thật rồi login lại |
| `scripts/Initialize-Dev.ps1`, `scripts/dev.ps1 db`, `scripts/Start-Preview.ps1` | PostgreSQL demo giữ volume cũ, V3 + demo staff migration áp dụng; menu 6 món, bàn 30 vẫn giữ. Chạy lại Initialize đối chiếu SHA256 `.env` trước/sau giống hệt |
| `Stop-Preview.ps1`, `backend/gradlew.bat -p backend --no-daemon bootJar`, `Start-Preview.ps1` sau chỉnh font cuối | Đóng gói jar cuối thành công, health UP; restart validate 6 migration, schema up to date, tài khoản cũ vẫn login được |
| Trong frontend: `E2E_BASE_URL=http://127.0.0.1:8080`, `npm.cmd run test:e2e` trên jar cuối | **20/20 Chromium đạt**, 7 auth + 10 menu + 3 bàn; chạy cuối 18,2 giây. Hai BrowserContext tách biệt, API thật/role, cookie/logout replay, mất session, lỗi login/logout/CSRF; toàn bộ hồi quy menu/bàn |
| Bố cục và kiểm tra ảnh | Login 768×1024, 1024×768, 375×812 không tràn; nút login ≥44px. Đã xem ảnh login tablet/mobile, nhân viên và bếp tại `.work/*-tablet.png`, `.work/login-mobile.png`; chỉnh font tiêu đề nội bộ cho dấu tiếng Việt |
| Review diff và dữ liệu nhạy cảm | `git diff --check` đạt; không sửa migration cũ/giá/menu/bàn có sẵn, không có mutation đơn/tiền. So sánh secret thật trong `.env` với source (gồm file mới), frontend dist và preview logs: không thấy giá trị secret. `.env`, log/ảnh/test report/dependency/build đều bị Git ignore |

Lỗi đã gặp và xử lý: sandbox chặn Gradle loopback/Docker nên chạy kiểm tra ngoài sandbox; jar preview cũ không còn file quản lý vẫn khóa jar Windows, đã xác minh command line đúng repository trước dừng; sửa generic overload của assert test và import extension TypeScript; test timeout ban đầu thất bại vì Tomcat làm tròn theo phút. Test cuối dùng listener chỉ rút phiên của đúng ca hết hạn xuống 2 giây, không bỏ qua filter/kiểm tra quyền. Không giảm assertion để bỏ lỗi nghiệp vụ.

### Đang chạy / chưa kiểm chứng / bước tiếp

- Preview cuối tại **http://127.0.0.1:8080/#login**, PostgreSQL demo còn chạy. Tài khoản `nhanvien`/`bep`; mật khẩu tương ứng là DEMO_STAFF_PASSWORD/DEMO_KITCHEN_PASSWORD trong `.env` root, không chép mật khẩu thật vào tài liệu. README có các bước thử hai cửa sổ riêng, gọi API trực tiếp, logout và đặt timeout 1 phút để thử tay.
- Không còn phần triển khai 6.2 đang dở chặn nghiệm thu local. Người dùng xác nhận đã thử đăng nhập thành công và giao chốt; đây là bằng chứng thử tay đăng nhập, không thay thế các kiểm tra tự động về logout/CSRF/quyền/expiry. Đã rà lại code, báo cáo 16 test PostgreSQL và 20 test Chromium đạt, workflow Linux và diff trước lưu; kết quả push/CI theo SHA thực tế ở mục chốt phía trên. Các run M1/menu phía dưới không phải bằng chứng CI của 6.2.
- Chưa thử Safari/iPad thật, LAN/WAN/HTTPS, tải đồng thời tại quán hoặc timeout 30 phút bằng tay (tự động đã kiểm tra expiry thật với thời hạn ngắn). Giữ localhost, Secure=false chỉ demo HTTP local; chưa tuyên bố sẵn sàng dùng thật.
- Quản trị/reset/thu hồi mọi phiên khi đổi tài khoản để 6.10. Bước tiếp sau 6.2 đã chốt là **6.3 — danh sách bàn và mở phiên phục vụ**; không tự thực hiện trong 6.2.

Các mục bên dưới là lịch sử trước 6.2; những câu “chưa có đăng nhập” áp dụng tại thời điểm ghi nhận đó.

## Push menu và kiểm chứng CI GitHub — 30/10/2026

- **Nhánh và quy trình thực tế:** local đang ở `main`, theo dõi `origin/main`; không có nhánh tính năng hoặc hướng dẫn PR bắt buộc trong repository. GitHub API xác nhận default branch `main`, nhánh không được bảo vệ và tài khoản có quyền push. Đã push fast-forward theo luồng hiện có; không force push, không tạo PR vì thay đổi đang ở `main`.
- **Commit menu đã lên GitHub:** [`430062867a28685063e9f981f204715490606b09` — feat: add database-backed sample menu](https://github.com/Davth325/restaurant-order/commit/430062867a28685063e9f981f204715490606b09). `git push origin main` thành công từ `c58445d` tới `4300628`; sau push, HEAD và origin/main khớp SHA này.
- **Rà trước push:** kiểm tra lại Git index 88 file bằng đối chiếu secret local và mẫu token/private key, không phát hiện vấn đề; `git diff --check` đạt, working tree sạch. Không đưa `.env`, log, dependency, build hoặc dữ liệu database lên GitHub.
- **Workflow hiện có:** `.github/workflows/ci.yml` — `Build and test`, đang active, chạy khi push/pull_request. Đã đọc nội dung và xác nhận trên GitHub; có lint/typecheck/build frontend, Java 21/Gradle clean build với PostgreSQL/Testcontainers, khởi động PostgreSQL Compose + jar và kiểm thử Playwright Chromium. Phù hợp phạm vi menu, không cần bổ sung hoặc giảm kiểm tra.
- **Kết quả thực tế:** [GitHub Actions run 41073537758](https://github.com/Davth325/restaurant-order/actions/runs/41073537758) có `head_sha=430062867a28685063e9f981f204715490606b09`, event `push`, trạng thái **completed**, kết luận **success**. [Job verify](https://github.com/Davth325/restaurant-order/actions/runs/41073537758/job/124123571466) xác nhận các bước frontend checks/build, backend build/test PostgreSQL, chuẩn bị môi trường, chạy jar, browser flow và dừng database đều success. Không có lỗi CI cần sửa hoặc bước bị bỏ qua để làm xanh.
- **Phạm vi bằng chứng:** kết quả trên áp dụng chính xác commit menu `4300628`; khác với các run M1 cũ. Bản cập nhật STATUS này được lưu và push bằng commit tài liệu riêng; xem SHA/run tương ứng trên GitHub, không suy kết quả của commit tài liệu chỉ từ run menu.
- **Hạn chế/bước tiếp:** giữ các hạn chế local/thiết bị thật đã nêu ở phần review; CI Linux không thay thế thử iPad/Safari hoặc LAN/WAN tại quán. Menu đã hoàn tất và có mốc GitHub/CI; việc tiếp theo là đăng nhập nhân viên/bếp, chưa triển khai trong phần menu này.

## Review và bàn giao menu — 30/10/2026

- **Hoàn thành:** menu mẫu database → API → UI đã được người dùng tự thử và xác nhận ổn. Review toàn bộ diff/schema/seed/backend/frontend/test; giữ API chỉ đọc, bind localhost, giá từ database, không sửa migration V1/V2 đã áp dụng hoặc dữ liệu demo.
- **Lỗi đã sửa:** ảnh lỗi không thử lại khi Làm mới cùng đường dẫn; một đường dẫn ảnh sai làm frontend loại cả menu; cảnh báo snapshot cũ biến mất trong lúc thử lại dù chưa đọc được dữ liệu mới. Sau sửa, ảnh có lượt thử lại, ảnh sai chỉ hiện placeholder và không được request, cảnh báo giữ tới khi snapshot mới thành công.
- **Bằng chứng tái hiện:** thêm 3 test hồi quy, chạy `npm.cmd run test:e2e -- --grep 'retries failed images|isolates an invalid image|keeps stale-menu'` trên bản trước sửa → cả 3 thất bại đúng lỗi nêu trên. Không bỏ/giảm assertion để làm test đạt.
- **Build sau sửa:** tại root, `scripts/Stop-Preview.ps1`, `scripts/dev.ps1 build` → exit 0; npm ci/lint, TypeScript/Vite build và Gradle clean build đạt. Báo cáo XML xác nhận **11 test PostgreSQL/Testcontainers**, 0 failures/errors (5 menu, 5 bàn, 1 schema/default profile), biệt lập database demo.
- **Browser sau sửa:** `scripts/Start-Preview.ps1`, rồi tại frontend đặt `E2E_BASE_URL=http://127.0.0.1:8080` và chạy `npm.cmd run test:e2e` → **13/13 Chromium đạt** (10 menu gồm 3 hồi quy mới, 3 bàn). Bao gồm menu thật/reload/giá/ảnh/trạng thái, lỗi/rỗng/thử lại, tablet dọc/ngang và màn hình nhỏ.
- **Review quyền/tiền/dữ liệu:** không có API ghi hoặc thay đổi đơn/thanh toán; seed không ghi đè giá/trạng thái; request cũ không cập nhật sau khi rời trang; mất kết nối không dựng menu giả. Không phát hiện thêm lỗi chặn bàn giao trong phạm vi menu chỉ đọc sau khi sửa và chạy lại kiểm tra.
- **Kiểm tra trước commit:** đối chiếu giá trị secret trong `.env` với source và bundle, quét mẫu token/private key và rà tên file; không phát hiện secret hoặc file môi trường thật trong nội dung đưa vào commit. `.env`, `.work`, dependency, build, log và dữ liệu database bị Git ignore; `.env.example` chỉ là mẫu giả. Kiểm tra lại trên Git index trước commit; `git diff --check` đạt. Đây là rà local theo mẫu/giá trị đã biết, không phải chứng nhận security audit toàn hệ thống.
- **Mốc lưu:** commit bàn giao `4300628` — `feat: add database-backed sample menu`, gồm menu và phần review này. Đã push/CI thành công theo mục ngày 30/10 phía trên; lịch sử CI M1 không được coi là bằng chứng cho menu.
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
- Không còn phần menu mẫu đang dở hoặc vướng mắc nghiệm thu local. Hạn chế, mốc commit sau review và bằng chứng push/CI Linux cho menu ở các mục phía trên.
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
