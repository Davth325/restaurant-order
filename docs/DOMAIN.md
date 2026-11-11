# Nghiệp vụ đề xuất để rà trước khi code

Các quy tắc dưới đây là thiết kế đề xuất cho bản đầu, trừ những yêu cầu được đánh dấu xác nhận trong PRODUCT.

## Gọi thêm và ngoại lệ — 6.7, cập nhật theo yêu cầu 11/11/2026

- Một lần xác nhận tạo đợt mới trong cùng phiên; không ghi đè đợt/dòng/số lượng/giá gốc. STAFF enabled gọi thay, lưu created_by từ principal ở database. MANAGER không tự kế thừa quyền gọi thay/mở bàn.
- Giữ cơ chế nhận toàn bộ hoặc từ chối toàn bộ khi món hết/giá đổi và idempotency 6.4. Cùng phiên/UUID nhưng nội dung hoặc nhân viên khác trả IDEMPOTENCY_CONFLICT, kể cả đổi kênh khách/nhân viên. Thiết bị khác cùng phiên vẫn được tra/retry đợt khách theo chính sách nhiều tablet đã chốt. UI so biên nhận UUID/từng món/số lượng/giá/ghi chú trước giải phóng pending.
- Khách tự hủy **từng suất còn QUEUED** thuộc phiên bàn đang hoạt động. Xác nhận hủy có hiệu lực ngay, không cần lý do hay duyệt. Từ PREPARING trở đi, khách không thể hủy. Lượt hủy giữ dấu vết thiết bị và thời điểm, không xóa suất hay đợt gốc.
- Gửi lại cùng khóa, cùng thiết bị và cùng suất trả thành công cũ. Cùng khóa khác suất hoặc thiết bị báo xung đột. Khóa phiên dùng chung với bếp: nếu bếp bắt đầu trước, khách nhận 409 và tạm tính giữ nguyên. Nếu khách hủy trước, bếp nhận 409 khi cố bắt đầu suất đó.
- Hủy thành công chuyển suất sang CANCELLED, tăng version và loại đúng suất khỏi tạm tính trong cùng transaction với biên nhận. Bếp đọc kết quả sau commit và hiển thị ở **Món đã hủy / loại tiền**. Snapshot khôi phục sau reconnect/restart. Serving không trả CANCELLED vào Chờ mang/Đang mang.
- Quản lý có chức năng điều chỉnh nội bộ, tách khỏi luồng khách. Quản lý enabled có thể hủy trực tiếp suất chưa giao hoặc loại suất đã giao khỏi tạm tính, có lý do và lịch sử. SERVED giữ trạng thái, người và giờ giao. STAFF không có hàng chờ duyệt hủy hay quyền điều chỉnh này.
- totalVnd là tổng gốc. netTotalVnd tính từ giá gốc của các suất chưa loại. Tạm tính phiên cộng netTotalVnd mọi đợt, mỗi suất chỉ loại một lần. Chốt hóa đơn và thu tiền thuộc 6.8. Tổng gốc tích lũy của phiên chịu giới hạn JSON an toàn.

Các mục 6.2–6.6 bên dưới ghi phạm vi ở thời điểm cũ; luật hủy/tạm tính hiện tại theo mục 6.7 này.

## Nhận mang và phục vụ đã triển khai — 6.6, 02/11/2026

- Luồng từng suất: QUEUED → PREPARING → READY (bếp đã xong, chờ mang) → PICKED_UP (nhân viên đã nhận) → SERVED (đã giao tới khách). Không đổi trạng thái cả bàn/dòng khi chỉ giao một suất. Trạng thái suất là nguồn chính, tiền/đợt gọi giữ nguyên.
- STAFF còn enabled được nhận suất READY. Lưu người nhận và giờ database; chỉ nhân viên đó được xác nhận giao hoặc trả lại. Hai người nhận cùng suất/phiên bản chỉ một người thành công; người còn lại nhận xung đột và đọc lại. Không nhận thay qua actor/time do client gửi.
- Mặc định quyền do Codex chọn cho demo 6.6: MANAGER giám sát mọi suất và lịch sử, được trả lại suất PICKED_UP của bất kỳ nhân viên nào; không nhận mang hoặc xác nhận giao thay. Quyền này chưa bao gồm quản trị menu/tài khoản, mở bàn, hủy hoặc thu tiền. STAFF khác không trả/giao suất của người đang nhận. Bếp và khách không có quyền phục vụ.
- Trả lại chỉ từ PICKED_UP → READY và bắt buộc lý do 1–300 ký tự sau bỏ khoảng trắng đầu/cuối. Xóa người/thời điểm nhận hiện tại, giữ thời điểm bếp xong để tiếp tục tính thời gian chờ; lịch sử vẫn giữ ai đã nhận/trả, lúc nào và lý do. Không trả SERVED về hàng đợi, không sửa xác nhận đã giao trong bước này; ngoại lệ thuộc 6.7.
- Mỗi thao tác chốt đúng một ID suất và phiên bản. Phiên bản tăng khi bếp hoặc nhân viên đổi suất, chống yêu cầu cũ có hiệu lực lại sau chu kỳ nhận → trả. Khóa UUID chống lặp gắn với actor/suất/phiên bản/hành động/lý do: retry giống hệt trả biên nhận cũ, không nhận lại; cùng khóa khác nội dung báo xung đột. Ghi trạng thái và lịch sử trong cùng transaction, lỗi ghi lịch sử rollback cả thao tác.
- Khóa phiên dùng chung với gửi món/bếp; OPEN và CHECKOUT_PENDING còn phục vụ, CLOSED chặn mutation và không có trong hàng đợi. Lịch sử nội bộ vẫn đọc được để đối chiếu. Chưa có đóng phiên qua UI.
- Hàng đợi nhân viên hiển thị từng dòng theo bàn/phiên/đợt, số suất đang ở từng trạng thái, tên/ghi chú và thời gian chờ từng suất từ lúc bếp xong. Ba mục Chờ mang / Đang mang / Đã phục vụ tách biệt; người nhận và giờ nhận hiện ở Đang mang/Đã phục vụ. Món đã giao không trở lại Chờ mang sau reload/restart. Nhân viên nhận thông tin trực tiếp; quản lý không phải chuyển tiếp thông báo.
- Theo phản hồi bổ sung chủ dự án ngày 02/11: STAFF chỉ có Chờ mang chung và Đang mang của chính mình; số đếm cùng phạm vi. Server chỉ trả READY và PICKED_UP có người nhận là tài khoản hiện tại, không trả suất người khác hoặc SERVED trong API workspace nhân viên. MANAGER vẫn xem mọi suất, có mục Đã phục vụ và lịch sử; chỉ MANAGER còn enabled được GET lịch sử. Không chỉ ẩn nút ở UI. Nhân viên vẫn tra được biên nhận của thao tác mình để khôi phục mất response, kể cả suất đã giao rời workspace. Quyền đọc tiến độ của khách/bếp giữ nguyên theo phạm vi hiện có.
- Nhân viên/quản lý và bếp nhận invalidation sau commit, đọc lại snapshot; polling/focus/reconnect dự phòng. Bếp tính READY/PICKED_UP/SERVED đều đã chế biến xong, không có nút bếp cho suất đang mang/đã phục vụ; đợt đã phục vụ hết rời mục chờ mang. Khách đọc tổng hợp queued/preparing/ready/pickedUp/served khi tải lại, chỉ trong phiên được gắn; không thấy tên nhân viên hoặc nhật ký nội bộ.
- Khi POST chưa rõ kết quả, lưu đúng lượt theo username trên trình duyệt, khóa thao tác mới, tra biên nhận trước khi retry cùng UUID/nội dung. Reload chỉ tra, không tự POST. Không xóa dữ liệu trình duyệt lúc chưa xác định. Snapshot cũ có cảnh báo và khóa thao tác cho tới khi đọc thành công.
- Demo bổ sung `nhanvien2` (STAFF) và `quanly` (MANAGER), mật khẩu ngẫu nhiên riêng trong `.env`; seed mới chỉ profile demo và không reset tài khoản đã có. Quy trình tài khoản thật để 6.10.

Các mục 6.2–6.5 bên dưới ghi phạm vi tại thời điểm đó; nhận mang/phục vụ và quyền quản lý hiện tại theo mục 6.6 này.

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
- Khách tự hủy từng suất còn chờ bếp theo luật 6.7 ở trên. Đợt và suất gốc vẫn có trong lịch sử.
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
