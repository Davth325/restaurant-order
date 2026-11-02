# Nghiệp vụ đề xuất để rà trước khi code

Các quy tắc dưới đây là thiết kế đề xuất cho bản đầu, trừ những yêu cầu được đánh dấu xác nhận trong PRODUCT.

## Bếp đã triển khai — 6.5, 02/11/2026

- Mỗi dòng gọi N suất có đúng N FulfillmentUnit, số thứ tự 1–N. Đơn 6.4 đã lưu được migration bổ sung suất chờ làm, giữ nguyên bàn/phiên/đợt/tên/giá/số lượng/ghi chú.
- Luồng hiện thực: QUEUED (Chờ làm) → PREPARING (Đang làm) → READY (Đã xong, chờ mang). Chỉ KITCHEN còn enabled được đọc hàng đợi và chuyển trạng thái; POST có CSRF. Chưa có hủy/từ chối/nhận mang/phục vụ trong bước này.
- Mỗi thao tác chỉ định ID suất và trạng thái đích. Không nhảy từ QUEUED tới READY, không lùi READY. Lặp đúng suất/đích hiện tại trả thành công mà không ghi lại người/thời gian; trạng thái đã đi xa hơn trả xung đột và đọc lại. Hai màn hình không thể làm vượt số suất, không dùng nút cộng số lượng chung.
- Backend lấy người thao tác từ principal và giờ từ database; giữ người/thời điểm bắt đầu và xong. Khóa phiên dùng chung với gửi món, chỉ thao tác khi phiên OPEN hoặc CHECKOUT_PENDING; CLOSED bị chặn và không còn ở hàng đợi.
- Hàng đợi gom theo bàn, phiên, đợt (số thứ tự trong phiên và mã đợt database), dòng món; mỗi suất có nút riêng. Trong đợt còn suất chưa xong, các suất READY vẫn hiển thị để đối chiếu tiến độ, ví dụ 1/3 đã xong, 2 chờ làm. Theo yêu cầu ngày 02/11, khi tất cả suất của tất cả món trong một đợt đều READY, đợt tự rời mục Đang xử lý và xuất hiện ở mục Đã xong · chờ mang. Chỉ lọc hiển thị, không xóa đơn/suất trong database; các đợt khác cùng bàn vẫn được xét riêng. Reload/reconnect mặc định mở Đang xử lý và phân loại lại theo snapshot server. Màn hình khách đọc tiến độ tổng hợp từ từng suất khi tải lại, không còn ghi cố định Chờ bếp.
- Mặc định UI: đợt cũ trước, tính thời gian từ lúc gửi; cảnh báo chữ Chờ lâu sau 15 phút nếu còn suất chưa xong. Đây là ngưỡng hiển thị demo, chưa phải SLA của quán. Đợt hoàn thành được xem lại ở Đã xong · chờ mang trong phạm vi phiên còn hoạt động; chưa có thao tác nhận mang/kết thúc phiên.
- PostgreSQL là nguồn chính; thông báo chỉ nhắc đọc lại. Mở lại, nối lại, quay về tab hoặc tải định kỳ đều đọc snapshot server. Lỗi đọc giữ dữ liệu cũ có cảnh báo và khóa thao tác; mất phản hồi chuyển suất không tự gửi một thao tác mới.


## Đăng nhập nhân viên/bếp đã triển khai — bước 6.2

- StaffUser định danh bằng username duy nhất, tên hiển thị, mật khẩu băm BCrypt, vai trò `STAFF` hoặc `KITCHEN`, cờ enabled. Backend lấy quyền từ tài khoản PostgreSQL; frontend không tự cấp quyền.
- `STAFF` được xem danh sách bàn và mở/xem phiên phục vụ theo bước 6.3 bên dưới; `KITCHEN` được vào khu vực bếp riêng. Hai vai trò không tự có quyền của nhau. Menu chỉ đọc công khai để giữ luồng xem menu hiện tại, chưa gắn quyền khách với phiên bàn. Chưa có quyền thu tiền/hủy/giảm hoặc quản lý tài khoản; không tạo vai trò quản lý chưa dùng.
- Demo có hai tài khoản tổng hợp `nhanvien` và `bep`, mật khẩu riêng sinh trong `.env` local. Flyway seed chỉ profile demo, không reset hash/tên/quyền/enabled đã tồn tại; profile mặc định không tạo tài khoản mẫu. Đổi `.env` sau seed không đổi mật khẩu đã lưu; quản trị/reset để 6.10.
- Sau đăng nhập, nhân viên vào sơ đồ bàn, bếp vào màn hình bếp. Ở mốc 6.2 bếp chỉ có điểm vào kiểm tra quyền; hàng đợi và thao tác từng suất hiện theo mục 6.5 phía trên.
- Phiên phía server có thời hạn 30 phút không có request sử dụng phiên; đăng xuất thu hồi ngay, restart server buộc đăng nhập lại nhưng giữ tài khoản. Kiểm tra lại khi quay lại tab và khi gọi API; UI bỏ dữ liệu nội bộ nếu nhận 401/403, yêu cầu đăng nhập lại. Chưa có quản trị thu hồi mọi phiên/đổi quyền giữa ca; thuộc 6.10.
- Đăng nhập sai dùng thông báo chung cho tài khoản không tồn tại, sai mật khẩu và tài khoản bị khóa; không phản hồi mật khẩu/hash. Mất kết nối khi đăng xuất phải báo chưa xác nhận được và cho thử lại.

## Bàn và mở phiên đã triển khai — bước 6.3, 31/10/2026

- Theo yêu cầu 6.3, bàn vật lý và lượt phục vụ là hai đối tượng riêng. Giữ B01–B30 từ seed hiện có, chạy lại không nhân đôi hoặc reset trạng thái. Không tạo phiên giả cho bàn đã có.
- Bàn hiển thị `AVAILABLE` (Bàn trống), `OCCUPIED` (Đang phục vụ), `NEEDS_CLEANING` (Chờ dọn). Chỉ bàn trống không có phiên hoạt động được mở; đang phục vụ/chờ dọn trả xung đột 409 rõ ràng, không trả thành công cho lần mở lại.
- Chỉ `STAFF` được mở và xem phiên qua API bàn, cùng cookie đăng nhập và CSRF hợp lệ. Bếp/anonymous không có quyền. Người mở lưu bằng khóa ngoại StaffUser lấy từ principal; thời gian do database ghi, không dùng người/thời gian/trạng thái do frontend gửi.
- Mở thành công tạo TableSession `OPEN` và chuyển đúng bàn sang `OCCUPIED` trong cùng transaction. Một bàn chỉ có tối đa một phiên hoạt động (`OPEN` hoặc `CHECKOUT_PENDING`); hai nhân viên cùng mở chỉ một người thành công, người còn lại nhận 409. Lưu `opened_by` và `opened_at` là dấu vết mở phiên; chưa tạo module audit tổng quát.
- Danh sách và chi tiết bàn trả phiên hiện tại với ID, trạng thái, người mở và thời gian. Phiên phục vụ lưu PostgreSQL nên còn sau reload/restart; phiên đăng nhập vẫn mất khi restart và cần đăng nhập lại. Phiên `CLOSED` không được trả là phiên hiện tại; lịch sử không bị ghi đè.
- Mặc định phạm vi 6.3: chưa có thao tác đóng phiên, dọn bàn, bill hoặc cấp quyền khách/tablet. Bàn chờ dọn được hiển thị và chặn mở, chưa có nút đưa về trống. Cơ chế gắn tablet/gửi món để 6.4; luồng đóng/dọn phía dưới vẫn là đề xuất cho bước tương ứng.
- Không tự gửi lại POST khi timeout/mất phản hồi: UI báo chưa xác định và yêu cầu đọc trạng thái mới trước thao tác tiếp. Lỗi đọc giữ cảnh báo dữ liệu cũ; không suy rằng bàn vẫn trống từ snapshot cũ.

## Menu mẫu đã triển khai — 30/10/2026

- MenuCategory gồm mã duy nhất, tên và thứ tự; MenuItem thuộc một nhóm, có mã duy nhất, tên, giá VND nguyên đồng, đường dẫn ảnh local, cờ còn bán và thứ tự.
- Giá mẫu lưu `BIGINT`/Java `long`, không âm; giới hạn tới 9.007.199.254.740.991 đồng để JSON number được JavaScript biểu diễn chính xác. Đây là giới hạn kỹ thuật, không phải mức giá áp dụng thực tế; chưa tính thuế/phí hoặc bill.
- Món hết vẫn xuất hiện với nhãn “Hết món”. Nhóm/món sắp theo thứ tự cấu hình, rồi ID. Nhóm trống được trả về; menu không có món là kết quả hợp lệ.
- Seed chỉ profile `demo`, tạo mẫu tổng hợp; chạy lại bỏ qua mã đã tồn tại, không ghi đè giá/tên/trạng thái đã sửa. Ảnh SVG minh họa đóng gói local, đường dẫn được lưu trong database.
- UI đọc lại API khi mở/tải lại trang, vào lại mục thực đơn hoặc bấm Làm mới. Không tạo danh sách món giả khi lỗi; snapshot cũ phải có cảnh báo giá/tình trạng có thể đã đổi. Chưa tự cập nhật realtime.
- API menu chỉ đọc, chưa có quản trị menu. Gửi món và luật kiểm tra giá/khả năng bán đã bổ sung ở mục 6.4 bên dưới.

## Tablet khách và gửi món đã triển khai — 6.4, 31/10/2026

- Nhân viên đang có quyền STAFF tạo mã ghép cho phiên OPEN; mã dùng một lần, hết hạn 5 phút. Tạo mã mới vô hiệu mã chưa dùng trước đó của cùng phiên. Khách nhập mã trên trình duyệt riêng; server từ chối ghép nếu trình duyệt còn đăng nhập nội bộ. Không dùng tài khoản nhân viên làm quyền gọi món khách.
- Thiết bị nhận credential riêng, chỉ cho một TableSession, hiệu lực tuyệt đối 12 giờ. Mỗi request kiểm tra credential và trạng thái phiên tại server; sửa ID phiên không có quyền sang bàn khác. CLOSED chặn cả xem và gửi; CHECKOUT_PENDING còn xem/lấy lại kết quả đã nhận nhưng không tạo đợt mới. Việc đóng phiên/checkout vẫn chưa có UI/API trong 6.4.
- Demo cho phép nhiều thiết bị được nhân viên cấp mã riêng cùng một phiên; tất cả đọc đơn của phiên đó từ server (cần tải lại để thấy đợt từ thiết bị khác). Người dùng chọn giữ hành vi này khi chốt bản 6.4 ngày 01/11/2026. Cấp mã mới không thu hồi thiết bị đã gắn. Giới hạn một thiết bị/bàn và đổi/thu hồi thiết bị riêng chưa triển khai; chính sách thiết bị dùng thật chưa chốt. Cookie và đơn vẫn có hiệu lực sau restart server, khác phiên đăng nhập nhân viên trong RAM.
- Giỏ gồm món, số lượng 1–20 suất/dòng, ghi chú tối đa 300 ký tự, tạm tính và bước xem lại. Tối đa 30 dòng/đợt. Đây là giới hạn demo do Codex chọn, không phải quy mô gọi món quán thật đã xác nhận. Menu hiện chưa có option; request phải có `optionIds: []`, option lạ bị từ chối. Không tự tạo buffet/combo/món theo cân, phí/thuế hoặc tùy chọn mẫu.
- Chấp nhận toàn bộ đợt hoặc từ chối toàn bộ. Server kiểm tra món tồn tại/còn bán, option, số lượng, giá khách đã xem và phiên; giá không khớp trả `PRICE_CHANGED` có tên/giá mới, món hết trả `ITEM_UNAVAILABLE`. Không âm thầm cập nhật tiền hoặc gửi thiếu món. Khách cập nhật giá/sửa giỏ rồi xem lại trước khi gửi.
- Tổng tiền tính bằng số nguyên tại server, không tin tổng/đơn giá chấp nhận do client khai. Snapshot tên món, đơn giá từ database, số lượng và ghi chú lưu trong OrderItem; sửa menu sau đó không đổi đơn. Tổng đợt không vượt giới hạn số nguyên JSON an toàn đã nêu ở menu. Tạm tính không phải hóa đơn/thu tiền.
- Một lần xác nhận tạo một OrderBatch với khóa UUID do client giữ. Cùng phiên + cùng khóa + cùng nội dung trả đúng đợt cũ (kể cả menu đổi sau đó); khác nội dung trả `IDEMPOTENCY_CONFLICT`. Unique database và khóa phiên bảo vệ cả gửi đồng thời. Giá được kiểm tra dưới khóa catalog tới commit; lỗi giữa chừng rollback cả đợt/dòng.
- Trước POST, client lưu lượt gửi/khóa vào localStorage theo phiên, không lưu credential ở đó. Timeout/mất phản hồi: khóa giỏ, tra bằng cùng khóa; chưa có mới cho retry cùng khóa/nội dung. Reload phục hồi lượt đang chờ. Chỉ bỏ lượt chờ khi nhận được đơn đã lưu hoặc lỗi nghiệp vụ chắc chắn từ chối; lỗi mạng/5xx không cấp khóa mới. Giỏ chưa bấm gửi chỉ ở bộ nhớ, không hứa giữ sau reload. Khi quyền khách hết hiệu lực, UI bỏ dữ liệu riêng và lượt chờ cũ khỏi máy.
- Món đã gọi đọc từ PostgreSQL, có đợt/thời gian/tên/đơn giá/số lượng/ghi chú. Khách không sửa/xóa món đã gửi. Từ 6.5, tiến độ được tổng hợp từ FulfillmentUnit theo mục bếp phía trên; hủy/phục vụ chưa triển khai.

## Thuật ngữ

- RestaurantTable: bàn vật lý, chẳng hạn B01. Không phải tài khoản khách dùng chung mãi mãi.
- TableSession: một lượt phục vụ khách tại bàn; hết lượt thì đóng và thu hồi quyền khách.
- OrderBatch: một lần khách/nhân viên bấm gửi món; nhiều đợt thuộc cùng một TableSession.
- OrderItem: món trong một đợt, gồm số lượng, tùy chọn, ghi chú và giá tại thời điểm gửi được chấp nhận.
- FulfillmentUnit: một suất cần làm/phục vụ. Gọi 3 suất thì có thể hoàn thành 1 suất trước; UI vẫn có thể gom thành một dòng “1/3 đã xong”.
- Bill: bảng tính tiền của phiên; khi chốt tạo phiên bản cố định để thu tiền.
- Payment: bản ghi thu tiền đã được người có quyền xác nhận; lưu phương thức và người thao tác.
- AuditEvent: dấu vết ai thực hiện thao tác quan trọng, khi nào, thay đổi gì, lý do nếu cần.

## Trạng thái

| Đối tượng | Luồng chính |
| --- | --- |
| Bàn | AVAILABLE → OCCUPIED → NEEDS_CLEANING → AVAILABLE |
| Phiên | OPEN → CHECKOUT_PENDING → CLOSED |
| Một suất món | QUEUED → PREPARING → READY → PICKED_UP → SERVED |
| Ngoại lệ suất món | QUEUED → CANCELLED hoặc REJECTED; sau PREPARING cần xử lý có thẩm quyền và lý do |
| Bill | DRAFT → AWAITING_PAYMENT → PAID |

Không bắt một trạng thái của cả đơn đại diện cho mọi món. Khách có thể đang ăn một món trong lúc món khác đang làm.

Phiên chưa phát sinh món có thể kết thúc không thu tiền; vẫn có người thao tác và lịch sử. Không tạo doanh thu giả cho phiên trống. Nếu mọi món bị loại bỏ, phải có lý do và người có thẩm quyền đóng bill bằng 0.

## Quyền và tablet

- Một bàn tối đa một phiên hoạt động, được bảo đảm cả ở database khi hai nhân viên cùng mở.
- Nhân viên kích hoạt thiết bị cho đúng phiên qua mã ghép ngắn hạn hoặc quy trình tương đương; chi tiết UX cần chốt.
- Token/cookie tablet chỉ có quyền của phiên khách, không chứa phiên quản lý để khách sử dụng lại.
- Server kiểm tra phiên đang mở trên mọi request; thay tableId trên URL không cấp quyền sang bàn khác.
- Đóng phiên thu hồi quyền ngay tại server. Tablet phải xóa giỏ và dữ liệu cũ trước khi giao khách tiếp.
- Tài khoản nhân viên định danh riêng; quyền thu tiền, giảm giá, hủy và quản lý nhân sự tách được.

## Gửi món và gọi thêm

- Giỏ chưa gửi có thể sửa tự do. Một lần gửi thành công tạo OrderBatch mới; không ghi đè các đợt cũ.
- Server kiểm tra phiên, món còn bán, option, giá và số lượng. Đề xuất bản đầu: một đợt được chấp nhận toàn bộ hoặc trả lỗi rõ để khách sửa; không âm thầm gửi thiếu món.
- Nếu giá thay đổi từ lúc khách mở menu, trả giá mới để khách xác nhận; không âm thầm tính cao hơn.
- Mỗi yêu cầu gửi có khóa chống trùng. Gửi lại cùng khóa, cùng nội dung trả kết quả cũ; khác nội dung báo xung đột.
- Khi timeout sau gửi, UI hiển thị “chưa xác định, đang kiểm tra”, tra lại trạng thái rồi thử lại cùng khóa. Không tự tạo khóa mới cho cùng lượt bấm.
- Khách không được xóa trực tiếp món đã gửi. Gửi yêu cầu hủy; nhân viên/bếp/quản lý xử lý theo trạng thái và quyền.
- Sau khi bếp bắt đầu, mọi hủy/loại khỏi bill phải có lý do và thông báo cho bếp. Không xóa lịch sử để làm mất dấu món đã chế biến.

## Bếp và phục vụ

- Bếp xác nhận số suất thật sự hoàn thành, không mặc định cả dòng 3 suất cùng xong.
- READY là chờ mang; PICKED_UP là đã có nhân viên nhận; SERVED là đã giao tới khách.
- Hai nhân viên cùng nhận một suất: chỉ một người thành công. Có thao tác trả lại hàng đợi khi cần, lưu lịch sử.
- Hai thiết bị bếp cùng thao tác không được làm số lượng vượt số đã gọi.
- Mọi chuyển trạng thái được kiểm tra trên server bằng transaction và cơ chế kiểm soát xung đột.

## Tiền và chốt bill

- Lưu giá/option/thuế/phí/giảm trừ áp dụng dưới dạng snapshot phù hợp; đổi menu không đổi lịch sử đã đặt/đã thanh toán.
- Giá và tổng tiền do server tính. Với VND nguyên đồng, dùng long/BIGINT; tỷ lệ và bước tính cần thập phân dùng BigDecimal. Không dùng float/double cho tiền.
- Trước khi chốt bill, mọi suất chưa kết thúc phải được phục vụ, hủy hoặc xử lý rõ; demo chưa hỗ trợ trả tiền trước khi ăn xong.
- Bắt đầu checkout khóa việc gọi thêm. Request thêm món đồng thời với checkout được tuần tự hóa bằng transaction/khóa trên phiên; không chỉ khóa nút ở UI.
- Muốn gọi thêm: nhân viên mở lại phiên nếu chưa ghi nhận thanh toán và chưa có giao dịch chuyển khoản đang cần đối soát; bill cũ bị thay thế có lưu dấu vết.
- Bản đầu: một bill trả toàn bộ bằng một phương thức. Partial payment, gộp tiền mặt + QR và refund tự động để sau.
- Tiền mặt: lưu tổng phải trả, tiền khách đưa, tiền thừa, nhân viên thu, thời điểm.
- QR: hiển thị tài khoản/số tiền/nội dung tham chiếu rõ. Nhân viên kiểm tra giao dịch ở nguồn ngân hàng rồi mới xác nhận. Ảnh chụp của khách hoặc nút “tôi đã chuyển” không làm bill thành PAID.
- Nếu không kiểm tra được tiền vào, giữ trạng thái chờ xử lý; quản lý quyết định cách phục vụ, không tự ghi đã thu.
- Xác nhận thu tiền có khóa chống trùng và ràng buộc chỉ ghi nhận thanh toán hợp lệ một lần cho bill trong phạm vi MVP.
- Tham chiếu giao dịch, nếu có, không được gán lại cho bill khác. Chuyển thiếu/thừa/trùng đưa vào hàng chờ đối soát quản lý; không tự sửa tiền phải trả.
- Xác nhận thành công phải ghi Payment, chuyển Bill sang PAID và đóng phiên theo cùng transaction phù hợp. Sau đó phát thông báo và thu hồi quyền khách.
- Sửa nhầm/hoàn tiền trước dùng thật cần quy trình điều chỉnh có người duyệt và nhật ký; không sửa/xóa Payment đã chốt trực tiếp.

## Nhập phiếu thủ công

- Mỗi phiếu giấy có mã duy nhất, bàn/phiên, thời gian, món, giá, số lượng, tiền đã thu và người ghi.
- Nếu món chưa làm: tạo đợt gọi thay bình thường và gửi bếp.
- Nếu món đã làm/đã phục vụ trong sự cố: nhập ở chế độ đối soát lịch sử, đánh dấu rõ, không gửi bếp lần nữa.
- Lưu thời gian phát sinh thực tế và thời gian nhập bù riêng. Chống nhập trùng theo mã phiếu.
- Nếu đã thu tiền thủ công, chỉ người có quyền đối soát mới ghi nhận vào hệ thống, lưu chứng cứ/tham chiếu phù hợp.
