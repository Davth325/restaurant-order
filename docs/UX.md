# Màn hình và tương tác

## Tablet khách đã triển khai — 6.4, 31/10/2026

- Nhân viên chọn bàn/phiên OPEN → Tạo mã gắn tablet; hiện mã dùng một lần, giờ hết hạn, bàn/phiên và hướng dẫn mở browser khách riêng. Đối chiếu đúng bàn trên tablet trước giao khách. Link cửa sổ mới không tự cách ly cookie; cần ẩn danh/profile/trình duyệt khác.
- Màn hình `/#guest` riêng; browser đang đăng nhập nội bộ bị chặn ngay ở UI và backend. Chưa gắn thì nhập mã; đã gắn hiện bàn/phiên, giỏ, món đã gọi và menu có nút Thêm. Menu công khai có link Gắn tablet ở cuối, giữ bố cục sidebar 6.3.
- Giỏ sửa số lượng/ghi chú/xóa, hiển thị giá và tạm tính; menu chưa có option nên nói rõ. Xem lại khóa sửa trước Xác nhận gửi, có Sửa giỏ để trở lại. Gửi thành công xóa giỏ, hiện đợt server và Chờ bếp. Khách không có thao tác sửa/xóa món đã gửi.
- Lỗi giá/món hết nói rõ toàn đợt chưa gửi, giữ giỏ để sửa; Cập nhật giá giỏ rồi bắt buộc xem lại. Giỏ chưa bấm gửi mất khi reload; lượt gửi chưa rõ kết quả giữ nguyên UUID/nội dung, khóa sửa, tra lại tự động một lần rồi cho Kiểm tra và thử gửi lại. Reload không cấp khóa mới. Không coi timeout là gửi thất bại chắc chắn.
- Món đã gọi có nút tải lại; lỗi giữ cảnh báo dữ liệu cũ, không dựng đơn giả. Quyền khách hết/phiên đóng thì bỏ dữ liệu riêng và yêu cầu gắn lại. Restart server không tự làm mất cookie khách; đóng/mở phiên qua UI chưa có trong bước này.
- Các nút/input vùng chạm tối thiểu 44px, giỏ một cột trên điện thoại; chữ/ghi chú dài không tràn ngang. Chromium mô phỏng tablet/phone không thay thế iPad/Safari thật; bằng chứng ở STATUS.

## Menu mẫu hiện có — 30/10/2026 (lịch sử trước 6.4)

Mở trang chủ thấy “Thực đơn hôm nay”; điều hướng “Thực đơn” / “Sơ đồ bàn” hoạt động cả trên màn hình nhỏ. Nhóm lọc lấy từ API, mỗi thẻ hiển thị ảnh minh họa, tên, giá VND và chữ Còn bán/Hết món. Menu công khai chưa gắn quyền khách với phiên bàn; không hiển thị một bàn khách giả hoặc nút thêm/gửi chưa hoạt động.

Nút và bộ lọc có vùng chạm ít nhất 44px; lưới thích ứng tablet dọc/ngang. Khi đang tải có thông báo và khóa Làm mới; menu trống có lời nhắn riêng; mất kết nối có nút thử lại. Nếu giữ snapshot cũ sau lỗi, cảnh báo rõ giá/tình trạng có thể đã thay đổi. Lỗi ảnh chỉ thay ảnh bằng placeholder, giữ tên/giá. Những màn hình khách/nhân viên/bếp bên dưới vẫn là thiết kế đề xuất.

Sau review: cảnh báo snapshot cũ được giữ trong lúc thử lại, chỉ bỏ khi đọc thành công. Làm mới thành công cũng thử tải lại ảnh từng lỗi dù đường dẫn không đổi. Đường dẫn ảnh không hợp lệ chỉ hiện placeholder cho món đó và không được request, không làm mất cả thực đơn.

## Đăng nhập nội bộ đã triển khai — 6.2

- Menu tiếp tục mở công khai ở `/#menu`. Liên kết Đăng nhập nội bộ mở `/#login`; truy cập sơ đồ bàn/bếp khi chưa đăng nhập cũng mở form, không hiển thị snapshot nội bộ cũ.
- Form có tên đăng nhập, mật khẩu, trạng thái đang gửi, thông báo sai thông tin chung và lỗi mạng; mật khẩu được xóa khỏi state/input sau mỗi lượt gửi. Hỗ trợ password manager, bàn phím và nhãn trường rõ; không ghi nhớ credential trong storage của ứng dụng.
- Thành công tự vào `/#tables` cho nhân viên hoặc `/#kitchen` cho bếp. Sidebar hiển thị tên/vai trò; đi nhầm màn hình có thông báo Không có quyền truy cập và đường về khu vực của mình. Bếp chưa có hàng đợi ở bước này, lời nhắn thể hiện đúng phạm vi.
- Logout thành công đưa về form. Nếu mất mạng, giữ thông báo chưa xác nhận đăng xuất và cho thử lại. Phiên bị thu hồi/hết hạn nhận 401/403 thì gỡ màn hình nội bộ và đề nghị đăng nhập lại; kiểm tra phiên khi quay lại tab. Không suy phiên đã hết chỉ từ lỗi mạng.
- Các màn hình gọi món/hàng đợi bếp phía dưới vẫn là đề xuất giai đoạn sau; mở phiên đã có ở 6.3 bên dưới.

## Sơ đồ bàn và mở phiên — 6.3

- `/#tables` cho nhân viên, 30 thẻ B01–B30 và lọc Khu A/B như trước. Tổng quan có trống/đang phục vụ/chờ dọn; trạng thái có chữ cùng màu, không suy số bàn từ mảng viết cứng trong UI.
- Chọn “Mở bàn B01” (bàn trống) hoặc “Xem bàn B01” (bàn khác) để hiện khu Chi tiết B01 và đọc trạng thái mới. Khu chi tiết cuộn vào vùng nhìn, có nút “Mở phiên B01” khi trống, bước xác nhận rõ đúng mã bàn. Đang đọc/lỗi dữ liệu/đang gửi thì khóa mở.
- Thành công hiện phiên #ID, người mở (tên và username), thời điểm theo múi giờ trình duyệt, trạng thái phiên; thẻ đúng bàn chuyển Đang phục vụ. Reload vẫn đọc API. Bàn có phiên không còn nút mở; chờ dọn có lời nhắn chưa sẵn sàng.
- Khi nhân viên khác vừa mở: nhận 409, thông báo không thể mở thêm và đọc lại chi tiết. Timeout/lỗi gửi chưa xác định: báo rõ, khóa mở/chọn bàn tới khi “Kiểm tra trạng thái B01” đọc thành công; không tự POST lại. Có thể rời trang và vào lại để đọc snapshot mới, backend vẫn bảo đảm không tạo trùng.
- Lỗi tải lại giữ snapshot kèm cảnh báo trong cả lúc đang thử lại; không mở dựa trên snapshot cũ. Phiên login hết hạn khi đọc/gửi thì bỏ bàn và quay về đăng nhập. Chưa có nút đóng/dọn hoặc gắn tablet trong 6.3.

## Khách trên tablet

- Luôn hiển thị bàn hiện tại và trạng thái kết nối tới hệ thống quán.
- Menu: nhóm món, ảnh, giá, option, hết món, nút thêm lớn; giỏ thể hiện tổng trước gửi.
- Xác nhận gửi: liệt kê món/số lượng/ghi chú; hiển thị giá thay đổi nếu có.
- Đã gọi: chia theo đợt, biết món đang làm, đã xong, đã phục vụ, bị từ chối.
- Tạm tính và yêu cầu thanh toán; QR/tiền mặt; gọi nhân viên.
- Nếu không nhận được phản hồi khi gửi: hiển thị chưa xác định và kiểm tra lại. Không báo “đã gửi” khi chỉ lưu trên tablet.
- Đóng phiên: màn hình kết thúc, không xem lại lịch sử lượt trước; chờ nhân viên gắn phiên mới.

## Nhân viên

- Sơ đồ 30 bàn, trạng thái bàn/phiên; hỗ trợ lọc bàn cần phục vụ hoặc cần thanh toán.
- Mở phiên, gắn tablet, gọi món thay và xem lịch sử đợt.
- Danh sách món READY: bàn, món, số suất, thời gian chờ; nhận mang và xác nhận giao.
- Thanh toán: người có quyền nhìn thấy bill đã chốt, tiền nhận/tiền thừa hoặc tham chiếu chuyển khoản.
- Dọn bàn và hoàn tất; màn hình nhập phiếu thủ công phân biệt đơn mới và đối soát món đã làm.

## Bếp

- Hàng đợi rõ số bàn, thời gian gửi, món, số lượng, ghi chú; cảnh báo món chờ lâu.
- Bắt đầu làm; hoàn thành từng suất, chẳng hạn 1/3. Có bảo vệ trước bấm lặp.
- Báo không làm được/hết món; thể hiện yêu cầu hủy và kết quả xử lý rõ.
- Khi màn hình bị ngủ rồi mở lại: tải trạng thái máy chủ, không dựa vào thông báo trong lúc ngủ.

## Quản lý

- Tổng quan bàn và đơn, các món chờ lâu, bill chưa thu, trường hợp cần đối soát.
- Menu/giá/khả năng bán, nhân sự/quyền, nhật ký thao tác.
- Báo cáo thu tiền trong ngày tách tiền mặt và chuyển khoản; định nghĩa ngày kinh doanh cần chốt trước dùng thật.
- Thấy tình trạng máy chủ/sao lưu phù hợp, không đưa lỗi kỹ thuật dài vào màn hình khách.

## Quy tắc giao diện

Thanh bên desktop cố định theo chiều cao vùng xem thực tế (`100dvh`), cuộn dọc riêng khi quá thấp và không làm co nhỏ vùng bấm. Khi chiều cao ≤760px, ẩn khối khẩu hiệu trang trí và giảm khoảng cách để giữ điều hướng/tài khoản/Đăng xuất trong vùng nhìn; không phụ thuộc máy là laptop hay desktop. Mobile ≤620px vẫn dùng header trong luồng trang với chiều cao tự nhiên. Quy tắc này cũng áp dụng khi Windows scale hoặc zoom trình duyệt làm giảm vùng xem CSS; không yêu cầu người dùng giảm zoom để bấm được Đăng xuất.

Ưu tiên tablet, nút cảm ứng dễ bấm, chữ rõ, tương phản đủ. Trạng thái có cả chữ và màu. Không dùng âm thanh như dấu hiệu duy nhất. Kiểm tra Safari/iPad thật; giới hạn tự phát âm thanh và việc màn hình ngủ có thể ảnh hưởng trải nghiệm.

Mỗi màn hình cần thiết kế trạng thái loading, rỗng, lỗi, bị từ chối quyền, mất kết nối và xung đột do người khác vừa thay đổi. Frontend không tự suy diễn đã thu tiền.
