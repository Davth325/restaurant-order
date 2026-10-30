# Nhật ký quyết định

| ID | Trạng thái | Quyết định | Lý do / điều kiện |
| --- | --- | --- | --- |
| D001 | Đã xác nhận | Demo trước, sau mới dùng thật | Theo chủ dự án ngày 29/10/2026. |
| D002 | Đã xác nhận | 30 bàn, một bếp | Theo chủ dự án. |
| D003 | Đã xác nhận | Java Spring Boot, Gradle, GitHub | Theo chủ dự án; đã có JDK 17 và 21. |
| D004 | Đã xác nhận | QR nhân viên kiểm tra và xác nhận | Chưa tích hợp tự xác nhận ngân hàng. |
| D005 | Đã xác nhận | Java 21 | Chủ dự án yêu cầu thực hiện M1 với Java 21 ngày 29/10/2026; dùng cho compile/test/runtime, giữ JDK 17 trên máy. |
| D006 | Đã xác nhận | React + TypeScript + Vite | Chủ dự án yêu cầu đủ ba công nghệ khi thực hiện M1 ngày 29/10/2026. |
| D007 | Đề xuất | Server và PostgreSQL tại quán | Mất WAN vẫn dùng được nếu LAN/server còn hoạt động. |
| D008 | Đề xuất | Một phiên cho một lượt khách, không dùng tài khoản bàn cố định | Cách ly lượt khách và thu hồi quyền tablet. |
| D009 | Đề xuất | Nhân viên thấy món xong trực tiếp | Giảm việc quản lý phải chuyển tiếp mọi thông báo. |
| D010 | Đề xuất | Một bill thanh toán toàn bộ một lần | Giới hạn độ phức tạp demo; cần xác nhận lại trước dùng thật. |
| D011 | Đề xuất | Không đồng bộ ghi độc lập trên mọi tablet ở MVP | Dùng máy chủ local giải quyết mất Internet; sự cố LAN/server có quy trình thủ công. |
| D012 | Chưa quyết định | Thuế/phí, chứng từ, điều chỉnh và hoàn tiền | Cần nghiệp vụ thật từ chủ quán. |
| D013 | Chưa quyết định | Cách hủy/giảm tiền và vai trò thu ngân | DOMAIN đang là quy tắc gợi ý. |
| D014 | Chưa quyết định | Máy chủ, HTTPS nội bộ, số tablet, topology Wi-Fi | Chọn sau khảo sát thiết bị và thử tải. |
| D015 | Đã xác nhận | PostgreSQL | Chủ dự án yêu cầu giữ PostgreSQL ngày 29/10/2026; phiên bản cụ thể chốt sau smoke test M1. |
| D016 | Đã xác nhận | Docker Desktop + Compose cho PostgreSQL trên máy phát triển | Chủ dự án chọn ngày 29/10/2026 để dựng database lặp lại được; chưa quyết định Docker/native cho máy tại quán. |
| D017 | Đã triển khai trong M1 | Spring Boot 4.1.2, Gradle Wrapper 9.8.2, PostgreSQL 18.6 và dependency frontend khóa phiên bản | Codex chọn kỹ thuật trong phạm vi M1 ngày 29/10/2026, dùng Initializr chính thức và build/smoke test thực tế; bảng phiên bản ở DEVELOPMENT. Wrapper có SHA-256; image PostgreSQL có digest. |
| D018 | Đã triển khai trong M1 | API bàn chỉ đọc, bind localhost; seed tách profile demo; UI trong jar khi đóng gói | Có lát cắt UI → API → PostgreSQL mà chưa cấp quyền phiên giả. Giữ Vite proxy cho phát triển; trước mở LAN phải có phân quyền M2. |

Khi thay đổi: thêm ngày, người chốt, lý do, phần bị ảnh hưởng, quyết định cũ được thay thế. Không biến đề xuất thành “đã xác nhận” chỉ vì Codex đã bắt đầu code.

## Rà soát trước bộ khung — 29/10/2026

- D005/D006 ban đầu là đề xuất; đã được yêu cầu M1 sau đó xác nhận Java 21 và Vite. Giữ JDK 17, dùng script chọn Java theo tiến trình.
- D006/D015/D016: cập nhật theo yêu cầu và câu trả lời của chủ dự án; ảnh hưởng build frontend và cách dựng PostgreSQL trong M1.
- D007/D011: vẫn là đề xuất máy chủ tại quán, cùng nguồn dữ liệu và không ghi độc lập trên tablet. M1 chuẩn bị tài nguyên local; thử mất WAN đầy đủ ở M6, không hứa đã chạy offline.
- Phiên bản đã được khóa và kiểm tra trong M1 theo D017; Gradle toàn máy không dùng làm chuẩn. Danh sách và nguồn ở DEVELOPMENT.
- Đã dùng Gradle Groovy DSL, package `com.restaurant.order` và schema tối thiểu cho lát cắt đọc bàn. Chưa tạo entity menu/order/bill; không chốt thêm nghiệp vụ thông qua seed.
- D008/D009/D010 và cơ chế ghép tablet: chốt trước M2 hoặc trước triển khai module liên quan. Loại menu theo suất/combo/cân chốt trước schema menu/order; thuế/phí/hủy/giảm/thu ngân chốt trước module liên quan, chưa đặt mặc định thành nghiệp vụ thật.
- D014: không chặn bộ khung chạy trên localhost; là điều kiện trước thử LAN/thiết bị và đưa vào quán. GitHub đích đã được chủ dự án cung cấp ngày 30/10/2026: `Davth325/restaurant-order`; tiến độ lưu source và CI ở STATUS.

Kế hoạch và điều kiện nghiệm thu M1 ở [tasks/M1-SCAFFOLD.md](tasks/M1-SCAFFOLD.md).
