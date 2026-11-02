# Hướng dẫn làm việc trong repository

## Bối cảnh

Ứng dụng gọi món tại nhà hàng: demo trước, dự kiến 30 bàn, một bếp; Java Spring Boot + Gradle; GitHub; QR do nhân viên xác nhận. Kiến trúc local tại quán và các chi tiết khác đang là đề xuất, xem docs/DECISIONS.md.

## Bắt đầu công việc

- Đọc README.md, docs/PRODUCT.md và docs/STATUS.md; sau đó đọc tài liệu liên quan tới việc đang làm.
- Với order, bếp, bàn hoặc tiền: đọc docs/DOMAIN.md và docs/TESTING.md.
- Với hạ tầng, dependency hoặc mạng: đọc docs/ARCHITECTURE.md và docs/OPERATIONS.md.
- Kiểm tra code hiện tại và trạng thái Git. Không coi kế hoạch hoặc STATUS là bằng chứng rằng chức năng đã tồn tại.
- Làm đúng phạm vi người dùng giao. Phân biệt “đã xác nhận”, “đề xuất” và “chưa quyết định”. Nêu rõ lựa chọn mặc định; hỏi khi thiếu thông tin làm thay đổi đáng kể nghiệp vụ.

## Trong khi thực hiện

- Chia thay đổi lớn thành các kết quả nhỏ có thể chạy thử; giữ luồng xuyên suốt UI → API → database.
- Giữ Java Spring Boot và Gradle theo yêu cầu. Đọc ARCHITECTURE trước khi chọn hoặc nâng phiên bản.
- Backend kiểm tra quyền, phiên bàn, giá và chuyển trạng thái; không tin dữ liệu giá/tổng tiền/quyền từ frontend.
- Các thao tác gửi món, nhận mang, thu tiền phải có cơ chế chống thực hiện trùng và kiểm soát thao tác đồng thời.
- Mọi thay đổi database dùng migration. Không sửa migration đã áp dụng ở môi trường dùng chung.
- Không để secret hoặc dữ liệu khách thật trong Git, log hay tài liệu mẫu.
- Ghi nghiệp vụ ở DOMAIN, lý do thay đổi ở DECISIONS, tiến độ ở STATUS; không duy trì nhiều bản cùng một sự thật.
- Đừng tự mở rộng sang cloud sync, chia hóa đơn, kho nguyên liệu hoặc QR tự động khi task không yêu cầu.

## Trước khi kết thúc

- Chạy các kiểm tra phù hợp với phần sửa. Nêu lệnh đã chạy, kết quả, và những gì chưa thể kiểm tra.
- Không ghi “pass” nếu chưa chạy; không sửa bài test để bỏ qua lỗi nghiệp vụ.
- Review diff về sai quyền, sai tiền, mất/trùng đơn và các trạng thái mất kết nối liên quan.
- Cập nhật docs/STATUS.md: đã làm, đang dở, bằng chứng kiểm tra, vướng mắc, bước tiếp.
- Nếu đổi nghiệp vụ/kiến trúc, cập nhật tài liệu tương ứng cùng thay đổi code.
- Báo kết quả bằng tiếng Việt, chỉ rõ cách người dùng tự kiểm chứng.

## Lệnh thực tế sau M1

- Tại root trên Windows: `.\scripts\Initialize-Dev.ps1`, `.\scripts\dev.ps1 db`, `.\scripts\dev.ps1 build`, `.\scripts\Start-Preview.ps1`. Mở http://127.0.0.1:8080.
- Dừng: `.\scripts\Stop-Preview.ps1`, `.\scripts\dev.ps1 stop`; volume database được giữ. Dừng Vite/preview trước build hoặc npm ci vì Windows khóa file đang dùng.
- Dev foreground: `.\scripts\dev.ps1 backend` và `.\scripts\dev.ps1 frontend` trong hai terminal root; Ctrl+C để dừng từng tiến trình. Vite ở http://127.0.0.1:5173.
- Kiểm tra Windows: `.\scripts\dev.ps1 test` khi UI/API đang chạy và Chromium đã cài. Lệnh này chạy Gradle test với PostgreSQL/Testcontainers riêng, typecheck/lint và Playwright.
- Backend riêng: dot-source `.\scripts\Use-Java21.ps1` tại root, vào backend rồi dùng `.\gradlew.bat`. Frontend riêng: vào frontend, `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e`.
- CI Linux cấu hình `bash ./gradlew --no-daemon clean build` tại backend sau build frontend; đọc STATUS và kết quả GitHub Actions thực tế. Không ghi CI pass chỉ từ file workflow.
- Xem README cho thứ tự khởi động/dừng; xem STATUS cho bằng chứng và hạn chế. API bàn/mã ghép cần STAFF, bếp cần KITCHEN, POST có CSRF. Sau 6.4 khách dùng cookie riêng có hash ở database và chỉ truy cập phiên được gắn; vẫn bind localhost, chưa có HTTPS để mở LAN.
- Kiểm tra live 6.4: `.\scripts\Verify-GuestOrdering.ps1` sau build/db, Chromium đã cài, cổng 8081 trống; script dùng database tạm riêng, không tiêu thụ bàn/đơn demo. Test UI thường mô phỏng guest để kiểm tra trạng thái lỗi, không coi mock là bằng chứng database.

- Kiểm tra live 6.5: `.\scripts\Verify-Kitchen.ps1` sau build/db, Chromium, cổng 8081 trống; dùng DB tạm riêng, kiểm hai bếp/SSE/từng suất/reconnect/restart. Chạy tuần tự với Verify-GuestOrdering vì cùng cổng. Bếp mở trực ca có polling giữ session, logout khi kết thúc.