# Hợp đồng đơn hàng — v1

Manage đã triển khai. Kitchen/Delivery hiện chỉ giữ chỗ; các trạng thái của hai module được thống nhất trước để dùng chung dữ liệu.

## Dữ liệu

```text
Entity { id: UUID, label: PHONE|PLACE|FOOD|QUANTITY|TIME|NOTE|PRICE, text: string }
Result { id: UUID, request: string, entities: Entity[] }
Order {
  id: UUID,
  status: WAITING|PREPARING|READY|DELIVERING|DELIVERED|CANCELLED,
  version: integer,
  history: Result[],
  selectedResultId: UUID,
  entities: Entity[],
  createdAt: ISO date string,
  updatedAt: ISO date string
}
```

MongoDB lưu `_id = id`; trường thời gian lưu kiểu Date, qua JSON thành ISO string. `entities` là bộ thực thể của `selectedResultId`, không cộng dồn các yêu cầu. Chưa có suy luận liên kết món với số lượng/giá; dữ liệu hiện là danh sách thực thể đúng phạm vi NER.

Bản nháp nằm trong bộ nhớ frontend; chỉ Confirm mới lưu Order. Khi xác nhận lại, thay history và entities của cùng ID, tăng version. Server có thêm confirmationId và digest để xử lý retry; không trả hai trường nội bộ này cho client.

## API hiện có

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| GET | `/api/health` | Kiểm tra tiến trình API, không đảm bảo model đã nạp |
| POST | `/api/analyze` | Body `{text}` → Result; không tạo đơn trong database |
| GET | `/api/orders?page=0` | `{orders, hasMore}`; 50 đơn/trang, updatedAt giảm dần; không kèm history |
| GET | `/api/orders/:id` | Order đầy đủ cùng history |
| PUT | `/api/orders/:id` | Xác nhận mới hoặc sửa Order, body như bên dưới |
| DELETE | `/api/orders/:id` | Body `{expectedVersion}` → `{deleted: true}`; xóa đơn/lịch sử khi còn WAITING và version trùng |

```json
{
  "confirmationId": "UUID mới cho mỗi thao tác xác nhận; giữ nguyên khi retry",
  "expectedVersion": 0,
  "selectedResultId": "UUID của kết quả được chọn",
  "history": []
}
```

Ví dụ trên mô tả hình dạng body; khi gửi thật phải dùng UUID v4 hợp lệ và history có kết quả được chọn, ít nhất một FOOD, không có thực thể rỗng. `expectedVersion = 0` để tạo mới; sửa phải gửi version vừa đọc. Server luôn chọn entities từ history, không nhận status hay version mới do client tự đặt.

Lỗi: 400 dữ liệu sai; 404 không có đơn; 409 xung đột trạng thái/phiên bản; 413 body quá lớn; 503 model chưa sẵn sàng/quá tải; 500 lỗi nội bộ. Response lỗi `{message}` không lộ connection string.

## Quy tắc đồng thời

- Confirm tạo `WAITING`. Chỉ sửa Order khi vẫn `WAITING` và version trùng.
- MongoDB update lọc đồng thời `_id`, `status`, `version` trong một thao tác atomic.
- Xác nhận trùng cùng confirmationId và cùng nội dung trả bản đã lưu; không tạo đơn thứ hai.
- Xóa dùng `deleteOne` lọc đồng thời `_id`, `status: WAITING`, `version`. Nếu đơn đã bị xóa, trả thành công để hỗ trợ retry; đơn đang xử lý hoặc version khác trả 409. Client đóng hội thoại đã xóa và gỡ bản nháp trong bộ nhớ. Bản nháp chưa lưu chỉ xóa local, không gọi API.
- Người B khi làm Kitchen/Delivery phải áp dụng cùng quy tắc atomic và tăng version mỗi lần đổi trạng thái; không dùng endpoint Manage để chuyển trạng thái.

Luồng dự kiến: `WAITING → PREPARING → READY → DELIVERING → DELIVERED`. Chuyển sang CANCELLED và xử lý giao thất bại cần thống nhất thêm trước khi triển khai. Manage khóa sửa với mọi trạng thái khác WAITING.

Danh sách hiện dùng phân trang offset; dữ liệu thay đổi liên tục có thể dịch vị trí giữa các lần tải trang. Frontend tải lại các trang đang xem và loại ID trùng; có thể chuyển sang cursor pagination khi quy mô tăng.

Không giới hạn số từ/ký tự hoặc số thực thể theo nghiệp vụ. API nhận tối đa 8 MiB/request, Order phải nhỏ hơn 16 MiB và history tối đa 20 kết quả. NER xử lý văn bản dài qua các cửa sổ chồng lặp, giữ mỗi từ một lần theo thứ tự nguồn.
