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
| D008 | Đã xác nhận trong yêu cầu 6.3 — 31/10/2026 | Tách bàn vật lý khỏi phiên từng lượt khách | Theo yêu cầu chủ dự án bước 6.3; gắn tablet/credential khách để 6.4, chưa chốt chi tiết cơ chế ghép. |
| D009 | Đã xác nhận trong yêu cầu 6.6 — 02/11/2026 | Nhân viên thấy món xong trực tiếp, quản lý giám sát | Theo yêu cầu chủ dự án; không cần quản lý chuyển tiếp mọi thông báo. |
| D010 | Đề xuất | Một bill thanh toán toàn bộ một lần | Giới hạn độ phức tạp demo; cần xác nhận lại trước dùng thật. |
| D011 | Đề xuất | Không đồng bộ ghi độc lập trên mọi tablet ở MVP | Dùng máy chủ local giải quyết mất Internet; sự cố LAN/server có quy trình thủ công. |
| D012 | Chưa quyết định | Thuế/phí, chứng từ, điều chỉnh và hoàn tiền | Cần nghiệp vụ thật từ chủ quán. |
| D013 | Hủy 6.7 cập nhật 11/11/2026; tiền khác chưa quyết định | Hủy theo trạng thái; giảm tiền khác/vai trò thu ngân còn chờ | Chính sách hiện tại ở D029/DOMAIN. Quy trình thu tiền/hoàn tiền còn chờ. |
| D014 | Chưa quyết định | Máy chủ, HTTPS nội bộ, số tablet, topology Wi-Fi | Chọn sau khảo sát thiết bị và thử tải. |
| D015 | Đã xác nhận | PostgreSQL | Chủ dự án yêu cầu giữ PostgreSQL ngày 29/10/2026; phiên bản cụ thể chốt sau smoke test M1. |
| D016 | Đã xác nhận | Docker Desktop + Compose cho PostgreSQL trên máy phát triển | Chủ dự án chọn ngày 29/10/2026 để dựng database lặp lại được; chưa quyết định Docker/native cho máy tại quán. |
| D017 | Đã triển khai trong M1 | Spring Boot 4.1.2, Gradle Wrapper 9.8.2, PostgreSQL 18.6 và dependency frontend khóa phiên bản | Codex chọn kỹ thuật trong phạm vi M1 ngày 29/10/2026, dùng Initializr chính thức và build/smoke test thực tế; bảng phiên bản ở DEVELOPMENT. Wrapper có SHA-256; image PostgreSQL có digest. |
| D018 | Đã triển khai trong M1 | API bàn chỉ đọc, bind localhost; seed tách profile demo; UI trong jar khi đóng gói | Có lát cắt UI → API → PostgreSQL mà chưa cấp quyền phiên giả. Giữ Vite proxy cho phát triển; trước mở LAN phải có phân quyền M2. |
| D019 | Đã triển khai menu mẫu — 30/10/2026 | Menu từ PostgreSQL qua API chỉ đọc; seed riêng demo, ảnh SVG local, giá mẫu VND nguyên đồng; trang chủ mở menu | Theo yêu cầu menu mẫu của chủ dự án. Codex chọn mặc định kỹ thuật để thử xuyên suốt UI/API/database và không cần dịch vụ ảnh ngoài; không chốt menu thật, thuế/phí, option hoặc quyền gửi món. Chi tiết nghiệp vụ ở DOMAIN, kỹ thuật ở ARCHITECTURE. |
| D020 | Đã triển khai bước 6.2 — 30/10/2026 | Spring Security, tài khoản PostgreSQL/BCrypt, session server + CSRF; STAFF/KITCHEN tách quyền; GET menu công khai | Theo yêu cầu đăng nhập nhân viên/bếp của chủ dự án. Codex chọn cookie HttpOnly/SameSite Strict, timeout 30 phút không request, mật khẩu demo ngẫu nhiên ngoài Git và Java migration Flyway. Menu giữ quyền xem hiện tại; không cần MANAGER trước module quản trị. HTTP/Secure=false chỉ localhost; HTTPS/LAN chưa chốt theo D014. Chi tiết quyền ở DOMAIN, triển khai ở ARCHITECTURE. |
| D021 | Đã triển khai bước 6.3 — 31/10/2026 | STAFF mở phiên bằng transaction/row lock bàn + partial unique index phiên hoạt động; lưu actor/time tại server; mở lại trả 409 | Theo nghiệm thu chủ dự án về hai nhân viên mở đồng thời và dữ liệu bền vững. Codex chọn JDBC join để trả cùng snapshot bàn/phiên, V4 không sửa migration/seed cũ; chưa cần cơ chế idempotency trả lại thành công vì yêu cầu mở lại phải bị từ chối. UI tra trạng thái khi kết quả chưa rõ. Không mở rộng đóng/dọn/ghép tablet hoặc thanh toán; DOMAIN/ARCHITECTURE mô tả chi tiết. |
| D022 | Đã triển khai bước 6.4 — 31/10/2026 | Mã ghép một lần do STAFF cấp; cookie khách riêng/hash PostgreSQL; gửi toàn đợt bằng UUID + khóa phiên + snapshot giá | Theo yêu cầu chủ dự án về quyền khách, không sai bàn, không trùng đơn và giá do backend kiểm tra. Codex chọn mặc định kỹ thuật, thời hạn/giới hạn demo và cho phép nhiều thiết bị được cấp riêng cùng phiên; không chốt chính sách thiết bị/menu thật. Menu chưa có option nên chỉ chấp nhận tập rỗng. V5 không sửa migration cũ, giữ localhost; bếp để 6.5. DOMAIN/ARCHITECTURE là nguồn chi tiết. |

Khi thay đổi: thêm ngày, người chốt, lý do, phần bị ảnh hưởng, quyết định cũ được thay thế. Không biến đề xuất thành “đã xác nhận” chỉ vì Codex đã bắt đầu code.

## D029 — Khách tự hủy suất còn chờ bếp, 11/11/2026

Chủ dự án yêu cầu bỏ luồng duyệt và ô lý do của khách. Khách xác nhận hủy từng suất QUEUED, có hiệu lực ngay. Từ lúc bếp bắt đầu, backend chặn khách hủy. Quyết định này thay phần duyệt hủy trong D028. Điều chỉnh nội bộ của quản lý vẫn là thao tác riêng có lý do.

V10 giữ lịch sử cũ và kết thúc yêu cầu PENDING cũ dưới trạng thái SUPERSEDED, giữ nguyên suất và tiền. Chọn endpoint và khóa lưu trên trình duyệt riêng cho thao tác tự hủy để nút hoặc lượt gửi từ phiên bản cũ không tự chuyển thành lệnh hủy. Luật hiện tại ở DOMAIN.

## D028 — Chính sách hủy và gọi thay 6.7, 03/11/2026

Chủ dự án trả lời **“Đồng ý chính sách đề xuất”** trước code phụ thuộc: khách yêu cầu từng suất; STAFF duyệt/từ chối khi QUEUED; PREPARING/READY/PICKED_UP chỉ MANAGER hủy có lý do/loại tiền/báo bếp; SERVED giữ trạng thái, chỉ MANAGER loại khỏi tạm tính; bếp bắt đầu trước STAFF duyệt thì xung đột và chuyển quản lý. DOMAIN là nguồn luật chi tiết. Chỉ phần hủy D013 được chốt, không mở rộng thu tiền/giảm giá/hoàn tiền.

Codex tiếp nối idempotency/khóa phiên, V8 lưu actor gọi thay và V9 lưu yêu cầu/quyết định/bill_excluded, không sửa V1–V7. Giữ giá/tổng gốc để đối chiếu, tạm tính mới từ suất chưa loại. Expected version bảo vệ hủy đồng thời bếp/serving; lịch sử cùng transaction, SSE sau commit và snapshot phục hồi. Chưa tạo Bill/6.8. Lối vào xử lý hủy ở Mang món/Giám sát phục vụ để giữ sidebar thấp đã nghiệm thu. Bằng chứng thực chạy ở STATUS.

## Rà soát trước bộ khung — 29/10/2026

- D005/D006 ban đầu là đề xuất; đã được yêu cầu M1 sau đó xác nhận Java 21 và Vite. Giữ JDK 17, dùng script chọn Java theo tiến trình.
- D006/D015/D016: cập nhật theo yêu cầu và câu trả lời của chủ dự án; ảnh hưởng build frontend và cách dựng PostgreSQL trong M1.
- D007/D011: vẫn là đề xuất máy chủ tại quán, cùng nguồn dữ liệu và không ghi độc lập trên tablet. M1 chuẩn bị tài nguyên local; thử mất WAN đầy đủ ở M6, không hứa đã chạy offline.
- Phiên bản đã được khóa và kiểm tra trong M1 theo D017; Gradle toàn máy không dùng làm chuẩn. Danh sách và nguồn ở DEVELOPMENT.
- Đã dùng Gradle Groovy DSL, package `com.restaurant.order` và schema tối thiểu cho lát cắt đọc bàn. Chưa tạo entity menu/order/bill; không chốt thêm nghiệp vụ thông qua seed.
- D008/D009/D010 và cơ chế ghép tablet: chốt trước M2 hoặc trước triển khai module liên quan. Loại menu theo suất/combo/cân chốt trước schema menu/order; thuế/phí/hủy/giảm/thu ngân chốt trước module liên quan, chưa đặt mặc định thành nghiệp vụ thật.
- D014: không chặn bộ khung chạy trên localhost; là điều kiện trước thử LAN/thiết bị và đưa vào quán. GitHub đích đã được chủ dự án cung cấp ngày 30/10/2026: `Davth325/restaurant-order`; tiến độ lưu source và CI ở STATUS.

Kế hoạch và điều kiện nghiệm thu M1 ở [tasks/M1-SCAFFOLD.md](tasks/M1-SCAFFOLD.md).

## D023 — Triển khai màn hình bếp 6.5, 02/11/2026

Theo yêu cầu chủ dự án, Codex triển khai FulfillmentUnit theo suất với chuyển QUEUED → PREPARING → READY; ID suất + trạng thái đích làm thao tác lặp an toàn, khóa phiên và UPDATE có điều kiện bảo vệ đồng thời. V6 chuyển đơn cũ sang từng suất và bỏ trạng thái dòng để giữ một nguồn sự thật. Chọn SSE invalidation sau commit, heartbeat và refetch/poll dự phòng theo ARCHITECTURE; không thêm dependency hoặc event broker. Chọn giữ các suất xong, thứ tự đợt cũ trước và ngưỡng chờ lâu 15 phút cho demo. Không thay chính sách nhiều tablet đã nghiệm thu 6.4, không mở LAN hoặc triển khai 6.6. DOMAIN/ARCHITECTURE mô tả hợp đồng; STATUS ghi bằng chứng thực chạy.

## D024 — Ẩn đợt đã xong khỏi hàng đợi chính, 02/11/2026

Chủ dự án yêu cầu: B02 đợt 1 hoàn thành thì rời màn hình làm món, có mục mở lại đã xong. Thay lựa chọn giữ mọi đợt trong cùng danh sách ở D023: mặc định Đang xử lý chỉ hiện đợt còn suất QUEUED/PREPARING; mọi suất của mọi dòng READY mới vào Đã xong · chờ mang. Phân loại theo batch ID từ snapshot server, không theo toàn bàn hoặc một dòng món; không xóa dữ liệu, không thêm mutation/migration hoặc triển khai nhận mang 6.6. Reload/reconnect phân loại lại, mặc định Đang xử lý. Chi tiết hiện hành ở DOMAIN/UX, bằng chứng ở STATUS.

## D025 — Nhận mang và phục vụ từng suất 6.6, 02/11/2026

Theo yêu cầu chủ dự án, Codex tiếp nối FulfillmentUnit với READY → PICKED_UP → SERVED, nhân viên nhận trực tiếp và quản lý giám sát. Chọn mặc định demo: STAFF nhận và tự giao/trả suất mình nhận; MANAGER được xem và trả lại bất kỳ suất PICKED_UP khi có lý do, không nhận/giao thay. Đây là lựa chọn triển khai trong phạm vi “quyền phù hợp”, chưa phải chính sách nhân sự quán thật được chốt riêng. Chưa thêm quyền hủy/thu tiền/quản trị.

V7 thêm version và lịch sử serving_operation: UUID chống lặp cùng expected version bảo vệ cả timeout/reload và yêu cầu cũ sau nhận → trả → nhận lại. Trạng thái và lịch sử commit cùng nhau dưới khóa phiên chung với ordering/kitchen; actor/time lấy backend. Dùng lại SSE invalidation, polling và snapshot PostgreSQL, không thêm dependency. Bổ sung hai tài khoản demo bằng seed mới, bảo toàn tài khoản/đơn cũ. Mở rộng D024: READY/PICKED_UP/SERVED đều bếp đã làm xong; đợt SERVED hết không còn mục chờ mang. Khách chỉ đọc progress trong phiên mình. DOMAIN giữ luật chi tiết, ARCHITECTURE giữ hợp đồng; 6.7 chưa triển khai.

## D026 — Đang mang tập trung vào món của chính nhân viên, 02/11/2026

Chủ dự án phản hồi ảnh màn hình nhân viên thấy cả món người khác đang mang, dễ rối khi nhiều món. Điều chỉnh UI: STAFF chỉ thấy PICKED_UP do chính mình nhận trong Đang mang, số đếm khớp danh sách; MANAGER vẫn xem mọi nhân viên để giám sát/trả lại. Chờ mang dùng chung, Đã phục vụ giữ phạm vi hiện có. Lọc khi dựng màn hình từ snapshot hiện tại; không biến bộ lọc UX thành thay đổi quyền API, không thay transaction/migration hoặc tiền.

## D027 — Giới hạn dữ liệu tại API, lịch sử chỉ cho quản lý, 02/11/2026

Chủ dự án tiếp tục thấy món của nhanvien2 ở cửa sổ nhanvien và yêu cầu lịch sử/Đã phục vụ chỉ cho quản lý. Ảnh cửa sổ đầu không có lời nhắc phạm vi mới, phù hợp với tab còn chạy bundle cũ; server hiện trả index bundle mới và Cache-Control no-store. D026 chỉ lọc phía UI nên chưa bảo đảm phạm vi với client cũ. Thay bằng lọc snapshot tại backend từ principal/ID/role hiện tại: STAFF nhận READY chung + PICKED_UP của mình; MANAGER nhận mọi trạng thái phục vụ. API lịch sử chỉ MANAGER enabled, kể cả session đang giữ role cũ; nhân viên không có tab Đã phục vụ hoặc nút lịch sử. Giữ tra biên nhận của chính người thao tác để phục hồi lost response; không đổi transaction ghi/schema/giá hoặc tiến độ khách/bếp. Cần tải lại trang ở từng cửa sổ sau cập nhật để lấy bố cục mới; không xóa dữ liệu trình duyệt đang có lượt chờ.
