# M1 — Tạo bộ khung theo từng kết quả kiểm chứng

Trạng thái: M1.1–M1.5 và nghiệm thu local M1.6 đã thực hiện ngày 29/10/2026. Build từ source sạch đạt; workflow CI đã cấu hình. Chủ dự án cung cấp GitHub đích ngày 30/10/2026; kết quả push/CI ở STATUS. Nguồn phạm vi: PRODUCT; kỹ thuật: ARCHITECTURE; quyết định: DECISIONS. Kết quả và lệnh thật: STATUS/README.

Mỗi việc dưới đây là một thay đổi nhỏ để chạy thử và review, cập nhật STATUS trước khi sang việc tiếp. Không coi việc đã có trên danh sách là đã hoàn thành.

Bằng chứng hiện tại: `dev.ps1 build` thành công; `dev.ps1 test` có 6 test backend và 3 test Chromium đạt; API qua Vite và jar đọc 30 bàn; đã kiểm tra dừng/tạo lại database giữ volume và restart backend. Các bảng dưới giữ tiêu chí của kế hoạch; kết quả cụ thể duy trì ở STATUS.

| Việc | Kết quả cần tạo | Cách nghiệm thu | Phụ thuộc |
| --- | --- | --- | --- |
| M1.1 — Repository và quy ước | Git local, .gitignore, bố cục monorepo; quy ước JDK 21 cho terminal/IDE/CI; kiểm tra không có secret | git status hoạt động; file sinh ra và .env được bỏ qua đúng; java/javac của phiên làm việc là 21. Ghi branch/remote thực tế nếu có | Thư mục hiện tại đúng; chưa cần GitHub remote để build local |
| M1.2 — Backend tối thiểu | Spring Boot + Gradle Wrapper tương thích JDK 21; khóa plugin; Java toolchain 21; health API tối thiểu, chưa cần schema nghiệp vụ | Wrapper báo JVM 21; build/test chạy; backend khởi động trên localhost và health trả thành công. Ghi lệnh Windows/Linux thực tế | M1.1, Internet để tải dependency lần đầu |
| M1.3 — Frontend nối API | React + TypeScript; đề xuất Vite; package-lock.json; trang trạng thái gọi health qua proxy /api | npm ci, typecheck, lint và build theo script thực sự tạo; UI hiển thị kết quả backend; tắt backend thì UI báo không kết nối được hệ thống quán | M1.2; Node/npm tương thích dependency |
| M1.4 — PostgreSQL và lát cắt dữ liệu | Compose PostgreSQL với volume và cấu hình secret ngoài Git; Flyway; schema bàn tối thiểu và seed B01–B30 chỉ cho demo; API đọc bàn và UI danh sách | Container chạy/healthy; migration áp dụng trên database trống; UI nhận đúng 30 bàn từ API/database; restart/recreate container với cùng volume vẫn còn dữ liệu; build và integration test migration/API với PostgreSQL thật | Docker Engine sẵn sàng; M1.2–M1.3. Chọn và khóa image/dependency sau smoke test |
| M1.5 — Gói chạy local | Frontend build được phục vụ cùng địa chỉ backend; tài nguyên cần cho màn hình M1 có tại máy, không tải CDN | Mở UI từ địa chỉ backend, đọc 30 bàn; restart backend rồi tải lại vẫn thấy dữ liệu. Chỉ xác nhận phạm vi màn hình M1; chưa tuyên bố toàn bộ luồng quán hoạt động khi mất WAN | M1.4 |
| M1.6 — Dựng sạch và CI | Hướng dẫn chạy thật trong README/AGENTS; CI build/test backend, frontend và PostgreSQL integration phù hợp | Dựng ở thư mục sạch theo README thành công; chạy kiểm tra local; sau khi có GitHub remote và push mới ghi nhận kết quả Actions thực tế | M1.5; repository GitHub/quyền truy cập cho phần CI từ xa |

## Lựa chọn còn mở và giới hạn

- Java 21 và Vite đã được chủ dự án xác nhận khi giao thực hiện M1. Đã dùng Gradle Groovy DSL, package `com.restaurant.order` và khóa các phiên bản theo D017; không thay Java toàn máy.
- PostgreSQL và React + TypeScript đã xác nhận; Docker Desktop + Compose chỉ chốt cho máy phát triển. Máy chủ tại quán vẫn là đề xuất.
- M1.4 giữ API đọc dữ liệu demo trên localhost; trước mở mạng cho người dùng phải thực hiện phân quyền/phiên ở M2. Không tạo endpoint mutation đơn/thu tiền hoặc cơ chế chọn tableId để cấp quyền khách trong M1.
- Không tạo sẵn tất cả entity order/menu/bill. Chốt loại menu và D008/D009 trước lát cắt M2; D010/D012/D013 trước phần thanh toán/hủy/giảm tương ứng. Cơ chế chống trùng/đồng thời sẽ nghiệm thu ngay khi có mutation liên quan.
- Chưa chốt thiết bị máy chủ, HTTPS nội bộ, topology Wi-Fi và tablet thật; không chặn smoke test localhost nhưng phải giải quyết trước thử tại quán.
- Không đổi sang database in-memory để ghi nhận PostgreSQL test thành công. Không đưa secret, dữ liệu khách thật, cloud sync, QR tự động, chia bill hay kho nguyên liệu vào M1.

## Ghi bằng chứng cho từng việc

Ghi thư mục chạy, lệnh thật, exit code/kết quả, phần chưa kiểm tra, thay đổi quyết định nếu có và bước tiếp vào STATUS. Chỉ bổ sung lệnh khởi động ứng dụng vào README/AGENTS khi các file/script đã tồn tại và đã chạy được. M1 hoàn tất khi lát cắt UI → API → PostgreSQL và dựng sạch đạt nghiệm thu; CI từ xa chưa chạy phải để rõ là chưa hoàn tất phần đó.
