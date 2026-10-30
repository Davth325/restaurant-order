# Mẫu giao việc cho Codex

## Bắt đầu chuẩn bị dự án

Đọc AGENTS.md, README.md, docs/PRODUCT.md, docs/DOMAIN.md, docs/ARCHITECTURE.md, docs/DECISIONS.md và docs/STATUS.md.

Đây là ứng dụng gọi món demo cho 30 bàn, một bếp; Java Spring Boot + Gradle, quản lý trên GitHub, QR do nhân viên xác nhận. Hãy rà các tài liệu và chỉ ra mâu thuẫn hoặc quyết định còn thiếu ảnh hưởng trực tiếp tới M1 và M2. Phân biệt yêu cầu đã xác nhận với đề xuất. Đề xuất lựa chọn mặc định có lý do, cập nhật kế hoạch và chia M1 thành việc nhỏ có điều kiện nghiệm thu. Phần việc hiện tại là chuẩn bị, chưa triển khai toàn bộ ứng dụng.

## Triển khai một tính năng

Đọc AGENTS.md, docs/STATUS.md và các tài liệu nghiệp vụ/kiến trúc liên quan. Thực hiện task [mã hoặc đường dẫn task].

Kết quả mong muốn: [hành vi có thể quan sát].
Điều kiện nghiệm thu: [các tình huống cụ thể].
Giới hạn phạm vi: [những phần chưa cần làm trong task này].

Kiểm tra code hiện tại, nêu cách thực hiện ngắn gọn rồi triển khai từ UI tới database khi task yêu cầu. Kiểm tra quyền, trạng thái, dữ liệu đồng thời và retry có liên quan. Chạy kiểm tra phù hợp, review diff, cập nhật STATUS và tài liệu bị thay đổi. Báo rõ lệnh đã chạy, kết quả và cách tôi tự kiểm thử. Với thiếu thông tin không chặn tiến độ, nêu giả định; với quyết định ảnh hưởng đáng kể nghiệp vụ tiền/đơn, hỏi rõ trước phần phụ thuộc.

## Tiếp tục trong chat mới

Đọc AGENTS.md, docs/STATUS.md và task đang làm. Kiểm tra nhánh hiện tại, thay đổi chưa commit và code thực tế; đọc thêm DOMAIN/ARCHITECTURE/DECISIONS theo phần việc. Tóm tắt ngắn phần đã có bằng chứng, phần còn dở và bước kế tiếp. Tiếp tục task [mã]; đừng dựng lại các phần đã hoàn thành hoặc coi ghi chú cũ là bằng chứng kiểm tra mới.

## Kết thúc một task để tôi review

Review thay đổi hiện tại theo điều kiện nghiệm thu của task. Ưu tiên sai quyền, sai bàn, sai tiền, trùng đơn và mất dữ liệu. Sửa lỗi trong phạm vi, chạy lại các kiểm tra liên quan. Cập nhật STATUS với kết quả thật, phần chưa kiểm tra và bước tiếp. Cho tôi hướng dẫn ngắn để thử trên các vai trò, cùng các quyết định còn cần tôi chốt.
