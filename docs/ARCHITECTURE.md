# Kiến trúc đề xuất

Stack đã xác nhận: Java Spring Boot + Gradle, React + TypeScript, PostgreSQL. Các chi tiết triển khai bên dưới vẫn là đề xuất nếu DECISIONS chưa ghi đã xác nhận.

## Bộ khung M1 đã triển khai

- Java 21, Spring Boot 4.1.2, Gradle Wrapper 9.8.2; phiên bản frontend/database ở DEVELOPMENT. Không dùng Gradle toàn máy.
- Module dining hiện có entity/repository/service/controller và DTO record cho `GET /api/tables`; trả danh sách đã đọc trong transaction read-only, tổng số và thời điểm đọc. Response no-store. Chưa có mutation, quyền hoặc phiên khách.
- Flyway V1 tạo restaurant_table với code duy nhất, seats > 0, tập trạng thái hợp lệ; JPA chỉ validate. Repeatable migration demo chỉ được thêm vào locations khi profile demo hoạt động, seed B01–B30 mà không reset bản ghi có sẵn.
- Frontend dùng relative /api, tải dữ liệu khi mở trang và khi bấm làm mới. Lỗi lần đầu không tạo bàn giả; lỗi khi đã có snapshot đánh dấu dữ liệu cũ. Chưa có SSE/polling tự động.
- Vite proxy /api trong phát triển. Khi build jar, Gradle frontendResources đưa frontend/dist vào BOOT-INF/classes/static. Build frontend trước backend; npm không tự chạy từ Gradle.
- Backend/Vite và cổng PostgreSQL chỉ bind 127.0.0.1. API chưa có đăng nhập chỉ phục vụ demo local; các quy tắc bảo vệ phiên bên dưới thuộc M2. Không mở địa chỉ bind ra LAN trước khi bổ sung quyền.
- Compose giữ PostgreSQL ở volume, healthcheck trước khởi động demo; cổng host mặc định 54329. .env ngoài Git được script tạo mật khẩu local ngẫu nhiên. Lỗi database API trả HTTP 503, health không lộ chi tiết cấu hình.

Đây là schema/API hiện có, không phải tuyên bố các module nghiệp vụ trong thiết kế bên dưới đã hoàn thành.

## Cách triển khai

Một ứng dụng Spring Boot chia module nghiệp vụ và một PostgreSQL tại quán. Frontend React build thành tài nguyên phục vụ cùng địa chỉ với API, qua Spring Boot hoặc reverse proxy local. Trong phát triển, Vite dùng proxy tới backend. Không cần microservices, Kafka, Kubernetes hoặc Redis cho demo này.

Máy chủ và database là nguồn dữ liệu chính. Internet phục vụ phát triển, GitHub, cập nhật, sao lưu ngoài quán tùy chọn và ngân hàng; không nằm trên đường bắt buộc của gửi món → bếp → thu tiền mặt.

Mất LAN khác mất WAN. Không tạo cơ chế mỗi tablet tự ghi đơn độc lập trong bản đầu. Nếu muốn điều đó về sau, phải thiết kế riêng đồng bộ, xung đột, nhận diện trùng và rủi ro thu tiền.

## Module backend

- identity: tài khoản nhân viên, quyền, đăng nhập, phiên thiết bị khách.
- menu: nhóm món, món, option, giá, khả năng bán.
- dining: bàn, phiên phục vụ, gắn thiết bị, yêu cầu hỗ trợ.
- ordering: đợt gọi, dòng món, xác thực giá, chống gửi trùng.
- fulfillment: hàng đợi bếp, trạng thái từng suất, nhân viên nhận mang.
- billing: bill, khóa checkout, ghi nhận thu tiền, đối soát.
- reporting/audit: tổng thu và nhật ký.

Chia package theo nghiệp vụ; trong module có controller/service/repository khi cần. Business rule nằm ở service/domain, không rải trong component UI hoặc controller.

## Dữ liệu cốt lõi

StaffUser, Role/Permission, RestaurantTable, TableSession, GuestDeviceSession, MenuCategory, MenuItem, MenuOption, OrderBatch, OrderItem, FulfillmentUnit, Bill, BillLine, Payment, AuditEvent. Thiết kế cụ thể và migration được tạo trong M1–M4, không tạo sẵn mọi entity chưa cần dùng.

- Ràng buộc một phiên hoạt động/bàn, quan hệ khóa ngoại, giá không âm, số lượng hợp lệ.
- Mã chống trùng cho các mutation quan trọng; không chỉ ngăn double click trên frontend.
- Transaction cho những thay đổi liên quan tới tiền và trạng thái phiên; chọn locking/version cụ thể khi triển khai và ghi lý do.
- Dữ liệu demo tách môi trường; Flyway quản lý schema. Không dùng tự động sửa schema ở môi trường thật.

## API và realtime

- REST API có DTO rõ ràng, validation, mã lỗi và thông báo tiếng Việt phù hợp.
- Các nhóm tài nguyên: menu, table sessions, order batches, fulfillment, bills, payments, staff, reports.
- SSE chỉ thông báo trạng thái đã lưu thành công. Client tải lại snapshot khi mở trang, reconnect và định kỳ khi cần.
- Nếu thông báo bị mất hoặc server restart, đơn vẫn còn trong PostgreSQL và xuất hiện sau refetch.
- Kênh SSE cần cùng kiểm tra quyền như REST; khách không được subscribe dữ liệu bàn khác.
- Sau khi có code, chọn một nguồn hợp đồng OpenAPI và kiểm tra đồng bộ với implementation; không chỉnh tay cả hai bản khác nhau.
- Trạng thái kết nối dựa vào truy cập backend local thực tế, không chỉ navigator.onLine. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)

## Bảo vệ phiên

Đề xuất session cookie HttpOnly, Secure ở môi trường dùng thật, chính sách SameSite và CSRF phù hợp; tài khoản staff và credential khách tách biệt. Khóa truy cập tablet theo TableSession và kiểm tra thu hồi ở backend. Có audit cho mở/đóng phiên, hủy món, điều chỉnh giá và thu tiền.

HTTPS tại địa chỉ nội bộ cần được thiết lập và kiểm tra trên các tablet mục tiêu trước dùng thật. Cơ chế cấp tên miền/chứng chỉ cụ thể phụ thuộc mạng thực tế, chưa được chốt. Không coi PWA là yêu cầu để mất Internet vẫn phục vụ được; service worker nếu bổ sung phải được thiết kế cache riêng và cần môi trường bảo mật phù hợp. [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## Phiên bản

Java 21 đã xác nhận cho compile/test/runtime. Phiên bản M1 khóa sau build/smoke test theo D017 và DEVELOPMENT. Khi nâng phiên bản, kiểm tra tương thích Spring Boot/Gradle/Flyway và thư viện liên quan; không chọn snapshot hoặc sao chép dependency từ hướng dẫn khác major mà chưa kiểm tra. Chưa thêm OpenAPI tooling ở M1.

Đã dùng script đặt JAVA_HOME/PATH theo terminal, toolchain 21 trong build và runtime preview Java 21; CI cấu hình Temurin 21. IDE cần đặt Project SDK và Gradle JVM 21. Toolchain chọn JDK compile/test, không thay thế việc kiểm tra JVM khởi động Gradle. Không ghi đường dẫn JDK của máy này vào build/gradle.properties dùng chung và không cần gỡ JDK 17. [DEVELOPMENT.md](DEVELOPMENT.md), [Gradle toolchains](https://docs.gradle.org/current/userguide/toolchains.html)

PostgreSQL trên máy phát triển dùng Docker Desktop + Compose theo D016. Image/digest, volume, biến môi trường đã cấu hình; đã kiểm tra giữ dữ liệu qua container recreate. Điều này chưa chốt cách cài dịch vụ trên máy chủ tại quán.

Các lệnh Windows đã chạy ghi ở README/AGENTS. Workflow Linux đã cấu hình; kết quả GitHub Actions thực tế duy trì ở STATUS.
