# Sản phẩm và phạm vi

## Đã xác nhận

Ngày 02/11/2026, chủ dự án giao **6.6 — nhân viên nhận mang và xác nhận phục vụ**: hàng chờ theo bàn/món/suất/thời gian, tách bếp xong/nhận mang/đã phục vụ, chỉ một người nhận cùng suất, trả lại có quyền và lịch sử, giao từng phần, nhân viên nhận thông tin trực tiếp và quản lý giám sát. Đã triển khai, người dùng giao chốt sau các phản hồi thử; chính sách quyền chi tiết ở DOMAIN, bằng chứng kiểm tra/commit/CI ở STATUS. Chưa triển khai 6.7.

Phản hồi thử 6.6 cùng ngày xác nhận: nhân viên chỉ xem món mình đang mang và hàng chờ chung; Đã phục vụ/lịch sử chỉ quản lý xem. Phạm vi đọc được áp dụng ở API và UI theo DOMAIN/D027.

Demo trước rồi triển khai thực tế; 30 bàn, một khu bếp; khách dùng tablet được chuẩn bị sẵn; gọi thêm món; bếp xác nhận món xong; nhân viên phục vụ; quản lý theo dõi; tiền mặt và QR xác nhận tay. Java Spring Boot + Gradle, React + TypeScript, PostgreSQL, GitHub. Có phương án tiếp tục phục vụ khi mất Internet. Máy chủ tại quán để chạy qua LAN khi mất WAN vẫn là kiến trúc đề xuất theo yêu cầu ngày 29/10/2026.

Khi giao thực hiện M1 ngày 29/10/2026, chủ dự án xác nhận thêm Java 21 và Vite; môi trường PostgreSQL phát triển dùng Docker Desktop + Compose. Bộ khung M1 chưa thay đổi phạm vi nghiệp vụ đề xuất dưới đây.

Ngày 30/10/2026, chủ dự án yêu cầu menu mẫu từ database: nhóm món, tên, giá, ảnh, còn bán/hết món; API và UI tablet có tải/rỗng/lỗi, tải lại trang vẫn đọc được. Phạm vi này chỉ xem menu; chưa chốt menu thật, giỏ hàng, gửi món, tùy chọn, buffet/combo/cân hoặc thuế/phí. Mặc định triển khai mẫu: giá VND nguyên đồng theo món, ảnh minh họa local; chi tiết ở DOMAIN.

Ngày 02/11/2026, bước 6.5 triển khai màn hình bếp: xem món đã gửi theo bàn/đợt, bắt đầu và hoàn thành từng suất, chống bấm lặp/thao tác đồng thời, cập nhật SSE và tải snapshot phục hồi. Chưa triển khai nhân viên nhận mang (6.6), hủy hoặc thanh toán. Chi tiết nghiệp vụ ở DOMAIN, bằng chứng ở STATUS.

## Mục tiêu demo

Ngày 31/10/2026, bước 6.4 triển khai nhân viên gắn tablet bằng mã một lần, quyền khách riêng theo phiên, giỏ/xem lại/gửi đợt gọi vào PostgreSQL, chống gửi trùng và tra kết quả khi mất phản hồi, xem món đã gọi sau reload. Giữ menu mẫu theo suất cố định hiện có, chưa có option trong dữ liệu; giới hạn demo và luật gửi cụ thể ở DOMAIN. Bếp mới ghi trạng thái Chờ bếp, màn hình bếp để 6.5; chưa mở LAN hoặc thay quyết định menu thật/thuế/phí.

Ngày 30/10/2026, bước 6.2 bổ sung đăng nhập tài khoản riêng cho nhân viên và bếp bằng Spring Security/PostgreSQL, mật khẩu băm, phân quyền ở API, đăng xuất và xử lý phiên hết hạn. Phạm vi triển khai và quyền hiện có ở DOMAIN; quản trị tài khoản để 6.10.

Ngày 31/10/2026, bước 6.3 bổ sung xem 30 bàn/trạng thái và nhân viên mở phiên cho bàn trống, lưu người/thời gian, chống hai nhân viên mở trùng và xem phiên hiện tại sau reload/restart. Tách bàn vật lý khỏi từng lượt khách theo yêu cầu; chưa đóng/dọn bàn hoặc gắn tablet/gửi món (6.4). Bằng chứng triển khai và phần chưa kiểm chứng ở STATUS.

Chứng minh một phiên ăn từ mở bàn tới thu tiền và dọn bàn, có nhiều đợt gọi món, nhiều màn hình cập nhật, không sai bàn/sai tiền/trùng đơn. Chứng minh khả năng làm việc nội bộ khi ngắt Internet theo kiến trúc được chọn.

## Vai trò đề xuất

| Vai trò | Công việc chính |
| --- | --- |
| Khách | Xem menu, gửi món, xem tiến độ và tạm tính của phiên mình, gọi nhân viên, yêu cầu thanh toán. |
| Nhân viên | Mở phiên, chuẩn bị tablet, gọi thay, nhận mang/đã phục vụ, thu tiền nếu có quyền, dọn bàn. |
| Bếp | Xem hàng đợi, bắt đầu làm, hoàn thành từng suất, báo hết món hoặc không thể làm. |
| Quản lý | Xem mọi bàn, cấu hình menu/giá, quản lý quyền, xử lý hủy/điều chỉnh, kiểm tra thu tiền và nhật ký. |

Quyền thu tiền có thể gán cho nhân viên hoặc thu ngân; chưa cần một ứng dụng thứ năm.

## Đề xuất có trong bản đầu

- Menu nhóm món, ảnh, giá, ghi chú và tùy chọn cơ bản; bật/tắt món còn bán.
- Phiên phục vụ theo bàn, gọi nhiều đợt, tạm tính, trạng thái từng suất.
- Màn hình bếp; danh sách món xong cho nhân viên; thông báo rõ khi mất kết nối máy chủ.
- Nhân viên gọi thay, xử lý yêu cầu hỗ trợ.
- Chốt hóa đơn, tiền mặt/QR xác nhận tay; nhật ký hành động quan trọng.
- Quản lý menu, tài khoản, báo cáo thu trong ngày.
- Nhập phiếu ghi tay theo chế độ phân biệt: cần gửi bếp hoặc chỉ đối soát món đã phục vụ.

## Đề xuất để sau

Đặt bàn, giao hàng, đa chi nhánh, chia/gộp/chuyển bàn phức tạp, chia thanh toán, voucher, tích điểm, kho nguyên liệu, QR tự động, nhiều máy chủ cùng ghi dữ liệu, tự đồng bộ đơn từ mọi tablet khi mất toàn bộ LAN. Nếu quán thật bắt buộc có mục nào, đưa vào phạm vi trước chạy thử.

## Cần chủ dự án chốt tiếp

1. Tính tiền gọi món thông thường hay có buffet, combo, món theo cân? Đề xuất demo: gọi món theo suất cố định.
2. 30 tablet cố định hay dùng luân chuyển? Nhân viên có điện thoại/tablet riêng không?
3. Ai được hủy món trước/sau khi bếp làm? Ai được giảm tiền hoặc sửa xác nhận thanh toán?
4. Giá đã gồm các khoản thuế/phí chưa, cần loại chứng từ/in nào? Chưa tự đặt thuế suất.
5. Có bắt buộc chuyển/gộp bàn hoặc chia bill trong lần dùng thật đầu tiên không?
6. Ngân sách và thiết bị máy chủ tại quán; hệ điều hành; có thể giữ máy chạy suốt ca không?
7. Menu thật, ảnh, lựa chọn món, số người dùng đồng thời, thiết bị/iPadOS mục tiêu?

Các câu hỏi về demo, quy mô, số bếp và xác nhận QR đã được trả lời; không hỏi lại.
