# Vận hành và phục hồi

## Bếp local sau 6.5

- V6 tự bổ sung từng suất cho đơn 6.4 đã lưu, giữ bàn/đơn/tiền cũ; backup/migration khi dùng thật vẫn theo quy trình bên dưới. Không reset volume để thấy món ở bếp.
- SSE chỉ là thông báo, snapshot PostgreSQL khôi phục sau reconnect/restart. Bếp mở trực ca sẽ polling giữ phiên login hoạt động; dùng Đăng xuất khi kết thúc ca. Restart yêu cầu bếp login lại, không xóa tiến độ suất.
- Verify-Kitchen.ps1 dùng DB verify_kitchen_<guid> và port 8081 riêng; chạy tuần tự với Verify-GuestOrdering.ps1 vì cùng cổng. Cookie/snapshot thử trong .work/kitchen-live-state.json bị ignore. Không chia sẻ dữ liệu thử hoặc .env.
- Khi API lỗi, bếp thấy cảnh báo dữ liệu cũ và nút bị khóa; đối chiếu trạng thái mới trước làm tiếp. Nếu hệ thống chưa phục hồi, quy trình giấy cần người điều phối để tránh làm trùng; chưa có tự đồng bộ giấy.
- Vẫn chỉ localhost; thử iPad thật cần LAN/HTTPS tin cậy và cookie Secure trước, chưa nằm trong 6.5.


## Tablet/đơn local sau 6.4

- V5 thêm credential khách và đơn vào PostgreSQL, không thay/reset bảng/phiên cũ. Giữ volume/.env, dừng preview trước build. Khách còn cookie hợp lệ vẫn vào lại đúng phiên sau restart jar; nhân viên vẫn phải đăng nhập lại. Thời hạn/quyền thiết bị và xử lý mất phản hồi theo DOMAIN; không xóa cookie/localStorage lúc lượt gửi chưa rõ kết quả.
- Kiểm tra riêng bằng `scripts/Verify-GuestOrdering.ps1`: dùng DB tạm tên `verify_guest_<guid>`, không chạm bàn/đơn demo. `.work/guest-live-state.json` chứa cookie kiểm thử tạm và snapshot để so sau restart; bị Git ignore, không chia sẻ. Script dọn đúng DB tạm trong finally.
- Preview vẫn chỉ localhost, Secure=false chỉ dành HTTP local. Việc có quyền khách không tự xác nhận sẵn sàng LAN; trước tablet thật vẫn cần HTTPS tin cậy/Secure=true, kiểm tra thiết bị và mạng như bên dưới. Không đổi bind ra LAN trong 6.4. Chưa có đóng/dọn bàn, bếp hoặc thu tiền; không dùng reset volume thay quy trình vận hành.

## Đã kiểm tra local trong M1

PostgreSQL phát triển chạy Compose, volume `restaurant-order_postgres_data` mount tại `/var/lib/postgresql`. Đã thử Compose down/up giữ volume: bản ghi kiểm tra vẫn còn sau tạo lại container; bản ghi đã được dọn, database demo trở lại 30 bàn. Trong thời gian database dừng, API trả HTTP 503; sau khởi động lại, API đọc được dữ liệu. Start/Stop-Preview quản lý riêng tiến trình jar bằng PID và thời điểm khởi động; lệnh thật ở README.

Đây là kiểm tra bộ khung localhost. Chưa thử ngắt WAN/LAN, mất điện, máy tại quán, HTTPS, backup hoặc restore; các mục bên dưới vẫn là thiết kế cần kiểm chứng.

## Trước demo LAN

Từ 6.3, phiên phục vụ lưu ở `table_session` cùng PostgreSQL với bàn/tài khoản. Dừng/chạy jar hoặc Compose với volume cũ giữ phiên/người/thời gian, nhưng HTTP session vẫn yêu cầu đăng nhập lại. Flyway V4 chỉ thêm schema, không tự tạo/reset phiên. Chưa có API đóng/dọn/reset bàn; không xóa volume để chuẩn bị lượt mới. Kiểm tra restart 6.3 và phạm vi database đã thử ghi ở STATUS.

Sau bước 6.2, local đã có phiên nhân viên/bếp nhưng vẫn bind localhost. Chuẩn bị `.env` qua Initialize-Dev trước seed Flyway demo; mật khẩu demo sinh riêng, chỉ bản băm vào PostgreSQL. Giữ `.env` khớp tài khoản đã seed, không đổi/xóa volume để reset mật khẩu. Không chạy profile demo tại quán thật; việc tạo/quản trị tài khoản thật để 6.10. Session lưu RAM, restart yêu cầu đăng nhập lại; không mất tài khoản/menu/bàn. Trước LAN phải thiết lập HTTPS tin cậy, `SESSION_COOKIE_SECURE=true`, tài khoản phù hợp và thử thiết bị mục tiêu. Các kết quả kiểm thử local không xác nhận đã vận hành LAN.

- Máy chủ có Java/runtime, PostgreSQL, frontend, ảnh/font/menu và tài khoản local đã chuẩn bị.
- Các gói phát hành và dependency cần thiết được tải trước; việc build mới có thể cần Internet, việc chạy bản đã cài phải không cần WAN cho chức năng cốt lõi.
- Có địa chỉ ổn định; thử tablet truy cập máy chủ khi router mất kết nối Internet.
- Tách trạng thái “không tới được hệ thống quán” khỏi “không có Internet”. Không khóa gửi món chỉ vì trình duyệt báo offline.
- Đảm bảo dữ liệu database/ảnh nằm ở nơi bền vững qua restart/recreate dịch vụ; đã chốt Docker cho máy phát triển, chưa chốt Docker/native cho máy tại quán.

## Kịch bản sự cố

### WAN mất, LAN còn

Tiếp tục gọi món và phục vụ local. QR chỉ xác nhận khi người có quyền thực sự kiểm tra tiền vào được bằng một đường kết nối khác; nếu không thì dùng phương thức khác hoặc giữ chờ đối soát theo quyết định quản lý.

### LAN/router hỏng, máy chủ còn

Nhân viên ghi phiếu có số thứ tự; quản lý nhập trực tiếp tại máy chủ, truy cập localhost. Bếp nhận phiếu giấy. Khi nhập cần biết món nào chưa làm và món nào đã phục vụ, tránh gửi làm hai lần.

### Máy chủ/database hỏng

Chuyển toàn bộ sang phiếu giấy theo bàn/phiên. Ghi tiền thu và người thu. Khôi phục dịch vụ theo quy trình đã thử, sau đó quản lý đối soát và nhập bù. Không hứa chuyển tự động sang máy khác nếu chưa xây và thử cơ chế đó.

## Trước dùng thật

- Quy định người chịu trách nhiệm máy chủ, cách khởi động lại và ai được truy cập dữ liệu.
- Tự khởi động dịch vụ sau reboot; tắt ngủ tự động phù hợp trong ca; kiểm tra ổ đĩa và đồng hồ.
- HTTPS được thiết bị tin cậy; firewall chỉ cho kết nối cần thiết; Wi-Fi khách không có quyền quản trị hệ thống.
- Cấu hình backup gồm database, ảnh và cấu hình cần phục hồi; secrets lưu bảo vệ riêng.
- Có bản sao ngoài máy chủ; bản ở cùng ổ đĩa không đủ cho trường hợp ổ hỏng. Có thể sao lưu ngoài quán khi Internet trở lại.
- Tần suất backup phụ thuộc mức mất dữ liệu chấp nhận được; chủ quán phải chốt khoảng mất dữ liệu tối đa và thời gian phục hồi mục tiêu.
- Phải thử restore, không chỉ thấy file backup được tạo. Lưu ngày, kết quả và các dữ liệu đã đối chiếu.
- Có hướng dẫn cập nhật, backup trước migration, và cách quay lại phiên bản tương thích với dữ liệu. Không giả định rollback code tự rollback được schema.
- Chạy thử một vài bàn và đối soát cuối ca trước mở rộng 30 bàn.
- Chốt xử lý thu sai/hoàn tiền, phiếu tính tiền/chứng từ, ngày kinh doanh, ca làm và phân quyền thật.

## Khi mở rộng về sau

Xem báo cáo từ xa có thể bổ sung cơ chế truy cập hoặc đồng bộ chỉ đọc. Hai máy chủ cùng ghi, cloud failover và tự xác nhận thanh toán qua webhook cần thiết kế riêng; webhook Internet không mặc nhiên gọi được vào máy chủ nội bộ. Không đưa các khả năng đó vào demo chỉ vì có GitHub hoặc có hosting.
