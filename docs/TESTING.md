# Kiểm thử và điều kiện nghiệm thu

Hiện có integration test PostgreSQL/Testcontainers và E2E Chromium tới bước 6.5: schema/seed/menu/bàn, đăng nhập 6.2, mở phiên 6.3, tablet và gửi món 6.4, bếp/từng suất/SSE 6.5. Kết quả thực tế ở STATUS, cách chạy ở README. Các mục ghi “giai đoạn sau” cùng kịch bản bếp/tiền/mạng chưa triển khai vẫn là yêu cầu, không được coi là đã kiểm tra.

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

## Bàn và mở phiên — 6.3

- Hồi quy thanh bên `sidebar.spec.ts`: 1366×600, 1280×630, 1024×500, 853×420 giữ điều hướng và nút Đăng xuất ≥44px trong vùng nhìn kể cả sau cuộn nội dung; 1024×240 có thể cuộn/focus và đăng xuất bằng bàn phím; mobile 375×812 không bị header chiếm hết màn hình hoặc tràn ngang. Trước sửa có hai test thất bại đúng lỗi cắt thanh bên; kết quả sau sửa ghi ở STATUS.

- `TableSessionIntegrationTests`: HTTP/cookie/CSRF thật với PostgreSQL/Testcontainers; B01 mở 201 có actor/time từ server (bỏ qua actor/time giả do client gửi), B02 giữ nguyên, mở lại 409 rõ mã lỗi. GET danh sách/chi tiết cùng phiên, login mới và chạy lại seed/Flyway không nhân đôi/reset. Không sửa migration cũ để test đạt.
- Hai tài khoản STAFF riêng mở đồng thời bằng hai HTTP session, lặp năm bàn: giữ row lock bằng connection riêng, đối chiếu `pg_stat_activity` để xác nhận cả hai transaction đang chờ khóa rồi mới thả; mỗi lượt đúng một 201 và một 409, đúng một bản ghi phiên. Test unique index trực tiếp chặn phiên thứ hai cả khi phiên đầu `CHECKOUT_PENDING`, giữ lịch sử `CLOSED` và trả đúng lượt hiện tại.
- Anonymous 401/bếp 403 khi có CSRF hợp lệ; thiếu CSRF 403; bàn không tồn tại 404/chờ dọn 409; dữ liệu lệch AVAILABLE nhưng có phiên hoạt động cũng bị chặn. Lỗi insert sau update bàn phải rollback, API trả 503 không lộ SQL/credential.
- `table-sessions.spec.ts`: login thật, mô phỏng response đọc/mở bàn cho UI xác nhận đúng B01/B02, actor/time/phiên, reload, xung đột 409, mất phản hồi không POST lại, khóa double-click, lỗi đọc trạng thái, phiên login hết hạn, cảnh báo snapshot cũ khi thử lại, chờ dọn và bố cục tablet/mobile. Không coi các mock này là bằng chứng transaction/database; bằng chứng đó thuộc test backend và kiểm tra live riêng ghi ở STATUS.
- E2E menu/bàn/auth cũ vẫn chạy API thật. Test UI mới không tiêu thụ bàn trống hoặc xóa phiên trên volume demo. Kiểm tra live UI → API → database và restart dùng database kiểm thử riêng, giữ B01 demo trống cho chủ dự án thử.
- Tự thử theo README. Chưa có API đóng/dọn nên không dùng xóa session/reset volume demo làm bước nghiệm thu. Kết quả/lệnh đã chạy thực tế và giới hạn thiết bị/CI ghi ở STATUS. Fixture UI giữ trạng thái bàn mô phỏng độc lập với dữ liệu demo có khách, gồm cả sau đọc lại mất phản hồi.

## Tablet khách và gửi món — 6.4

- `GuestOrderIntegrationTests`, PostgreSQL/Testcontainers + HTTP/cookie/CSRF thật: STAFF tạo mã, anonymous/KITCHEN/thiếu CSRF bị chặn; mã thay thế/hết hạn/một lần; browser STAFF không ghép được; cookie khách HttpOnly/path riêng, hash DB không phải token thô, không có quyền nội bộ.
- Hai phiên/thiết bị riêng, cấm GET/POST/tra khóa sang phiên kia; CLOSED thu hồi ngay, CHECKOUT_PENDING chặn đợt mới, credential hết hạn bị 401. Giá giả/giá đổi, món không tồn tại/hết, option lạ, số lượng/ghi chú/tổng vượt giới hạn không tạo đợt/dòng một phần. Snapshot giữ nguyên khi đổi menu; lặp cùng khóa trả nguyên đợt, khác nội dung 409; đổi thiết bị vẫn thấy đơn server.
- Hai request cùng khóa qua hai cookie riêng thực sự cùng chờ khóa phiên (đối chiếu pg_stat_activity) rồi chỉ tạo một đợt. Ép lỗi insert dòng sau insert đợt phải rollback toàn bộ, 503 không lộ SQL; retry cùng khóa sau phục hồi thành công.
- `guest.spec.ts` dùng mock guest để kiểm tra UI giỏ/xem lại/double-click, mất response rồi tra khóa, reload pending và gửi lại cùng nội dung, lỗi giá/món hết yêu cầu xem lại, quyền hết bỏ dữ liệu, browser STAFF bị chặn và ba kích thước dọc/ngang/phone. Menu/CSRF vẫn từ API thật. Không gọi mock là bằng chứng transaction/database.
- **Live cách ly demo**: `.\scripts\Verify-GuestOrdering.ps1` (sau build/db, Chromium, cổng 8081 trống) tạo database riêng → staff mở B01/B02 và cấp mã qua UI → hai BrowserContext nhập mã → hai giỏ gửi và reload → sửa ID/giá/tổng/khóa → chặn response sau request đã commit → lỗi trước commit và tra khóa không tới được, reload rồi retry cùng khóa → restart jar với cookie đã lưu → đối chiếu toàn bộ đơn, count/sum DB. Dọn database riêng trong finally; không thao tác bàn/đơn demo.
- Hồi quy menu/auth/bàn/sidebar chạy cùng suite thường. Số test và lệnh/kết quả thực tế chỉ ghi ở STATUS; không suy CI/Linux/Safari/thiết bị thật từ test Windows/Chromium.

## Màn hình bếp — 6.5

- KitchenIntegrationTests dùng PostgreSQL/Testcontainers, HTTP/cookie/CSRF thật: bàn/đợt/ghi chú, 3 suất và hoàn thành 1, lặp đích không thay actor/time, sai luồng không lùi/nhảy, tài khoản bị vô hiệu, phiên đóng, anonymous/STAFF/guest/thiếu CSRF bị từ chối.
- Hai HTTP session bếp chờ cùng khóa phiên thật (đối chiếu pg_stat_activity) cho cả PREPARING và READY; kết quả đúng READY/QUEUED/QUEUED. Không coi hai lời gọi tuần tự là kiểm chứng tranh chấp.
- Ép lỗi insert suất thứ hai: rollback toàn batch/dòng/suất. Kiểm tra migration schema riêng từ V5 có đơn cũ lên V6: giữ nguyên dữ liệu và bổ sung đúng 3 suất. Stream HTTP thật kiểm connected/changed, snapshot đã commit và logout đóng stream mà không có AuthorizationDeniedException/response already committed trong log server; assertion log được kiểm tra thất bại trên code trước sửa.
- kitchen.spec.ts mock snapshot/mutation để thử bố cục 768×1024, 1024×768, 375×812; ghi chú dài, 1/3, nút ≥44px, snapshot cũ/khóa nút/phục hồi, xung đột và hết phiên. Bổ sung ca một món xong nhưng món khác trong đợt còn làm, hoàn thành suất cuối mới chuyển mục, đợt khác cùng bàn giữ nguyên, mở xem lại và reload không mất đợt. Mock chỉ là bằng chứng UI, không thay PostgreSQL.
- scripts/Verify-Kitchen.ps1 chạy jar ở 8081 trên database verify_kitchen_<guid> riêng: STAFF mở/gắn hai bàn qua UI, khách gửi thật, hai bếp SSE, hoàn thành 1/3, mất response đã commit, reload, chặn SSE/polling, offline khóa rồi refetch, guest đọc tiến độ, restart jar/login lại và so toàn bộ suất/đơn. Bổ sung hoàn thành B02 đợt 1 qua UI: biến khỏi hàng đợi cả hai bếp (kể cả polling), mở xem lại, reload và restart vẫn có trong mục đã xong; B01 2/3 vẫn ở đang xử lý. Đối chiếu DB 3 đợt/225.000đ/5 suất/3 READY; dọn đúng DB tạm, không tiêu thụ dữ liệu demo.
- Hồi quy toàn bộ test cũ và Verify-GuestOrdering.ps1. Lệnh/kết quả thực tế và giới hạn ở STATUS; không suy CI hoặc Safari/iPad/LAN từ test local.


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
