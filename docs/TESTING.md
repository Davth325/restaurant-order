# Kiểm thử và điều kiện nghiệm thu

Hiện có integration test PostgreSQL/Testcontainers và E2E Chromium cho schema, seed, menu/bàn và đăng nhập/phân quyền 6.2. Kết quả thực tế ở STATUS, cách chạy ở README. Các mục ghi “giai đoạn sau” cùng kịch bản gọi món/tiền/mạng chưa triển khai vẫn là yêu cầu, không được coi là đã kiểm tra.

## Kiểm tra bộ khung M1

- Migration trên database trống, seed demo 30 bàn; profile mặc định không seed dữ liệu demo.
- API trả snapshot từ PostgreSQL, phản ánh bản ghi kiểm thử vừa commit; no-store; POST bàn bị từ chối.
- PostgreSQL từ chối code bàn trùng và seats không hợp lệ; health backend kiểm tra kết nối database.
- Trình duyệt tải dữ liệu thật, lọc khu vực, hiển thị lỗi mạng và tải lại phục hồi, đánh dấu dữ liệu cũ; bố cục tablet 768 × 1024 không tràn ngang.
- Thử vận hành local riêng: dừng database → API 503; tạo lại container với cùng volume → marker kiểm tra còn, dọn marker → API trở lại 30 bàn. Không phải thử mất WAN toàn quán.

## Kiểm tra menu mẫu

- PostgreSQL/Testcontainers: V2 và seed demo, default không seed nhóm/món, thứ tự API/no-store, giá nguyên đồng và món hết; sửa database rồi đọc lại nhiều lần; seed không ghi đè/nhân đôi; menu không có món; từ chối giá không hợp lệ/khóa ngoại sai; POST 405; lỗi đọc database trả 503 không lộ chi tiết.
- Chromium với API thật: đối chiếu nhóm/tên/giá/ảnh/tình trạng, reload trang và đổi menu ↔ bàn. Chặn request để kiểm tra loading/rỗng, lỗi mạng/HTTP, thử lại, cảnh báo snapshot cũ, response sai và ảnh lỗi.
- Hồi quy review menu: giữ cảnh báo snapshot cũ trong lúc thử lại; ảnh lỗi phục hồi sau Làm mới cùng đường dẫn; một đường dẫn ảnh sai chỉ làm hiện placeholder của món đó, không gửi request ra ngoài vùng ảnh hoặc loại cả menu.
- Bố cục kiểm tra ở 768 × 1024, 1024 × 768 và 375 × 812; không tràn ngang và vùng chạm bộ lọc ≥44px. Chưa thay thế kiểm tra iPad/Safari thật.
- Thử local với database phát triển: đọc menu, restart jar rồi đọc lại; đối chiếu dữ liệu không bị seed reset. Lệnh, kết quả thực chạy và hạn chế duy trì ở STATUS.

## Đăng nhập và quyền — 6.2

- Integration PostgreSQL với HTTP/cookie thật (không mock user): menu public, anonymous 401, hai vai trò đúng API 200/sai API 403, URL ngoài danh sách bị từ chối; không lộ hash trong `/me`.
- Sai username/mật khẩu, enabled=false đều không đăng nhập được; thông báo lỗi chung không lộ dữ liệu. BCrypt hash khớp mật khẩu test; Flyway chạy lại không reset hash/nhân đôi; default profile không seed tài khoản.
- Login/logout thiếu CSRF hoặc dùng token trước login bị 403; login đổi session ID; logout xong phát lại chính cookie cũ vẫn 401.
- Hết hạn thật ở servlet server → API 401 → login lại được. Test listener chỉ rút thời hạn phiên test xuống 2 giây vì Tomcat làm tròn cấu hình Boot theo phút; không thay filter/logic xác thực. Runtime vẫn timeout 30 phút mặc định.
- Playwright dùng hai BrowserContext cách ly cho nhân viên/bếp, gọi thẳng API kiểm quyền, menu khi anonymous, vào sai trang, reload giữ login, logout cách ly và phát lại cookie cũ. Test mất session trên tab đang xem → không còn thẻ bàn → đăng nhập lại.
- UI sai mật khẩu/xóa input, mạng lỗi login rồi phục hồi, mạng lỗi logout và thử lại; CSRF thiếu; login trên 768×1024, 1024×768 và 375×812. Hồi quy toàn bộ menu/bàn có quyền.
- Tài khoản E2E đọc từ biến môi trường hoặc `.env` bị Git ignore; không dùng credential chung viết cứng. Không đưa báo cáo/trace local vào Git.
- Thay đổi kỳ vọng mutation menu anonymous: trước Security là 405; nay không CSRF là 403. POST bàn của nhân viên có CSRF hợp lệ vẫn 405 vì chưa có API ghi.
- Cách chạy và số test/kết quả thực tế ở README/STATUS. Chưa thay thế Safari/iPad thật, LAN/HTTPS và kiểm tra vận hành tại quán.

## Luồng chính (giai đoạn sau)

1. Mở B01 → gắn tablet → gửi 2 món → bếp làm → nhân viên mang → gọi thêm → chốt bill → thu tiền → đóng → dọn → mở lượt mới.
2. Thực hiện tương tự ở B02 đồng thời; không nhầm dữ liệu giữa hai bàn.
3. Gọi 3 suất cùng món; bếp hoàn thành 1 rồi 2; nhân viên giao từng phần đúng số lượng.

## Quyền và phiên

- Khách sửa ID trên URL/request không xem hoặc thao tác được bàn khác; kiểm tra cả SSE.
- Khách không tự sửa giá, tự xác nhận thanh toán hoặc gọi API quản lý.
- Hai nhân viên cùng mở bàn chỉ tạo một phiên hoạt động.
- Credential lượt cũ không dùng được sau đóng phiên, kể cả khi giữ tab cũ.
- Đổi tablet không làm mất đơn đã gửi; không lộ dữ liệu lượt trước.

## Trùng lặp và đồng thời

- Bấm gửi hai lần hoặc timeout sau khi server đã lưu: chỉ tạo một đợt gọi.
- Cùng khóa chống trùng nhưng nội dung khác: bị từ chối rõ ràng.
- Hai nhân viên cùng nhận một suất món: chỉ một người nhận được.
- Bếp thao tác lặp không vượt số suất đã gọi.
- Gọi thêm đồng thời chốt bill: hoặc món vào trước và được tính, hoặc bị từ chối sau khóa; không có món lọt ngoài bill.
- Hai nhân viên xác nhận thu tiền cùng lúc: chỉ một Payment được ghi nhận hợp lệ.

## Menu và tiền

- Món hết hoặc giá đổi giữa xem menu và gửi: khách nhận thông báo đúng, không âm thầm tính giá khác.
- Sửa giá menu không sửa giá OrderItem/Bill đã lưu.
- Hủy trước/sau khi bếp làm theo đúng quyền, có lý do và audit khi cần.
- Tính tiền chính xác với số lượng, option, giảm trừ, thuế/phí đã chốt; không sai do số thực.
- Tiền khách đưa nhỏ hơn phải trả: không hoàn tất thu tiền mặt.
- Khách bấm “đã chuyển” hoặc chỉ gửi ảnh: bill chưa PAID.
- Mất đường truy cập ngân hàng: QR còn chờ xác nhận; không tự chuyển sang PAID.
- Nhập bù cùng một phiếu hai lần không nhân đôi doanh thu và không gửi lại món đã làm cho bếp.

## Mạng và vận hành

- Ngắt WAN nhưng giữ LAN: mở mới trình duyệt, đăng nhập local, tải menu/ảnh, gửi món, làm món, thu tiền mặt đều chạy. Thử cả sau khi restart server lúc WAN vẫn mất.
- Chặn SSE nhưng REST còn hoạt động: polling/refetch phục hồi trạng thái, không mất đơn.
- Tablet mất Wi-Fi trong lúc gửi: hiển thị chưa xác định, sau reconnect tra lại và không gửi trùng.
- iPad ngủ rồi mở lại: tải lại trạng thái, phiên/quyền còn đúng.
- Router hỏng, server sống: quản lý thao tác trên localhost được; ghi giấy và nhập không nhầm bàn.
- Restart server sau khi đơn đã commit: dữ liệu còn; xác nhận thành công không xuất hiện nếu giao dịch chưa hoàn tất.
- Phục hồi bản sao lưu sang database thử nghiệm độc lập và đối chiếu các bill/món/Payment mẫu.
- Giả lập 30 phiên bàn cộng màn hình bếp/nhân viên; đo thời gian phản hồi, lỗi, trùng đơn và tải máy. Mục tiêu phản hồi cụ thể được chốt sau baseline và thử thiết bị thật.

## Mức kiểm tra

- Unit test: quy tắc tính tiền/chuyển trạng thái có nhiều nhánh.
- Integration test với PostgreSQL: transaction, quyền, ràng buộc, idempotency, đồng thời và migration.
- E2E: các luồng quan trọng trên những phiên trình duyệt cách ly theo vai trò.
- Kiểm tra bằng tay trên thiết bị thật: cảm ứng, bố cục, Safari, ngủ/thức, mất mạng, âm thanh.

Không tạo test chỉ để có số lượng. Mỗi lỗi sai tiền, sai bàn, trùng đơn hoặc sai quyền nên có cách tái hiện và kiểm tra hồi quy phù hợp.
