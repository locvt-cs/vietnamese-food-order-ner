# Tổ chức ứng dụng quản lý đơn hàng

Kiến trúc mục tiêu: một frontend React, một backend FastAPI và MongoDB dùng chung cho ba trang **Manage**, **Kitchen**, **Delivery**. Mỗi trang là một module trong cùng ứng dụng. Cấu trúc dưới đây là định hướng triển khai, không phải danh sách các thành phần đã hoàn thành.

## Cấu trúc thư mục

```text
system/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx                # Bố cục và điều hướng chung
│   │   │   └── routes.jsx             # /manage, /kitchen, /delivery
│   │   ├── features/
│   │   │   ├── manage/                # UI và logic Manage
│   │   │   ├── kitchen/               # UI và logic Kitchen
│   │   │   └── delivery/              # UI và logic Delivery
│   │   └── shared/
│   │       ├── components/            # Thẻ đơn, nút, bộ lọc dùng chung
│   │       ├── hooks/                 # Logic dùng chung
│   │       └── api/                   # HTTP client và API đơn hàng
│   ├── .env.example                   # Cấu hình mẫu, không chứa secrets
│   ├── package.json                   # Dependencies cho cả ba trang
│   └── package-lock.json              # Thống nhất dùng npm
├── backend/
│   ├── app/
│   │   ├── main.py                    # Khởi tạo FastAPI
│   │   ├── core/                      # Cấu hình và kết nối database
│   │   ├── routers/
│   │   │   ├── manage.py              # Nhập, trích xuất, xác nhận đơn
│   │   │   ├── kitchen.py             # Nhận và cập nhật chế biến
│   │   │   └── delivery.py            # Nhận và cập nhật giao hàng
│   │   ├── schemas/                   # Schema dữ liệu vào/ra dùng chung
│   │   ├── services/
│   │   │   ├── order_service.py       # Quy tắc đơn hàng/chuyển trạng thái
│   │   │   └── ner_service.py         # Tích hợp model NER hiện có
│   │   └── repositories/              # Đọc/ghi MongoDB dùng chung
│   ├── tests/                         # Kiểm tra API và nghiệp vụ
│   ├── .env.example                   # Database URI, đường dẫn model, ...
│   └── requirements.txt               # Dependencies runtime backend/NER
├── docs/
│   └── order-contract.md              # Schema đơn, API, luồng trạng thái
├── scripts/
│   └── seed_demo.py                   # Tạo dữ liệu mẫu trên database local
├── .gitignore                         # Bỏ qua môi trường, cache, secrets
├── docker-compose.yml                 # Tùy chọn, bổ sung khi cần
└── README.md
```

Chỉ tạo thư mục/file khi có phần triển khai tương ứng. Tái sử dụng code và model NER hiện có qua cấu hình/import; không sao chép sang từng module.

## Phân công full stack

| Phụ trách | Module | Nhiệm vụ xuyên suốt |
| --- | --- | --- |
| Người A | Manage | UI nhập đơn → API gọi NER → sửa/xác nhận kết quả → lưu đơn và theo dõi trạng thái |
| Người B | Kitchen | UI danh sách đơn → API nhận chế biến → lưu trạng thái sẵn sàng |
| Người B | Delivery | UI đơn chờ giao → API nhận giao → lưu kết quả giao hàng |
| Người A và người B | Phần dùng chung | Thống nhất schema/API, bố cục, cấu hình, review chéo và kiểm tra toàn luồng |

Mỗi người làm cả frontend, backend và thao tác dữ liệu của module mình. Các module xử lý cùng một đơn hàng theo ID, không tạo bản sao riêng cho bếp hoặc giao hàng.

## Ý tưởng thực hiện

1. Chốt `docs/order-contract.md`: trường dữ liệu, request/response API, trạng thái và quyền chuyển trạng thái của từng module.
2. Dựng luồng nhỏ: tạo đơn → lưu database → Kitchen thấy đơn. Chuẩn bị dữ liệu mẫu để mỗi người tự chạy mà không cần người còn lại online.
3. Phát triển các module theo hợp đồng đã chốt. Kết quả NER là bản nháp để kiểm tra/sửa trước khi xác nhận chuyển cho bếp.
4. Backend kiểm tra và cập nhật có điều kiện theo trạng thái hiện tại để tránh xử lý trùng. Các trang lấy trạng thái từ backend; ban đầu tự làm mới định kỳ, bổ sung cập nhật tức thời khi cần.

Luồng ban đầu:

```text
DRAFT → CONFIRMED → PREPARING → READY → DELIVERING → DELIVERED
     Manage             Kitchen               Delivery
```

Thống nhất các trường hợp hủy/giao thất bại trước khi bổ sung. Quy tắc đơn hàng nằm trong `order_service.py`, tránh viết lặp ở từng router.

## Làm việc bất đồng bộ qua Git

1. Lấy `main` mới nhất, tạo nhánh cho một việc nhỏ, ví dụ `feat/manage-create-order` hoặc `feat/kitchen-order-status`.
2. Viết code, tự kiểm tra, commit và push nhánh; mở pull request (PR).
3. Người còn lại review khi có thời gian. PR ghi ngắn gọn: **đã làm gì, cách chạy thử, ảnh hưởng API/schema, phần còn thiếu**.
4. Sửa theo review, kiểm tra và merge vào `main`. Đồng bộ `main` trước việc tiếp theo; cập nhật thêm thay đổi từ `main` nếu nhánh đang làm kéo dài.

Người review có thể sửa và push cùng nhánh sau khi trao đổi trên PR; không force-push nhánh dùng chung. Có thể tiếp tục việc độc lập khi chờ review; ghi rõ nếu phụ thuộc PR chưa merge. Thay đổi API/schema phải cập nhật hợp đồng cùng code và thông báo phần bị ảnh hưởng.

## Giữ tài nguyên gọn gàng

- Mỗi máy có một `node_modules` cho frontend và một môi trường Python cho backend/NER nếu dependencies tương thích; không tạo môi trường riêng cho từng trang. Backend chỉ cần dependencies phục vụ suy luận, không mặc định cài toàn bộ công cụ huấn luyện.
- Model/cache NER nằm ở một vị trí được cấu hình cho mỗi môi trường chạy. Nạp model khi khởi động tiến trình phục vụ NER, tránh tải/nạp lại theo từng request; nhiều worker có thể nhân bộ nhớ model nên chỉ tăng khi cần.
- Commit file khai báo dependencies và lockfile. Thêm package phải cập nhật các file liên quan cùng PR và nêu mục đích; tránh nhiều thư viện giải quyết cùng một việc.
- Thống nhất npm cho frontend; dùng `npm ci` để thiết lập/đồng bộ theo lockfile. Chỉ đồng bộ dependencies khi cần, không xóa/cài lại môi trường sau mỗi lần pull.
- Không commit `node_modules`, `.venv`, `.env`, cache, log hoặc model nặng vào Git thông thường. Giữ `.env.example` và hướng dẫn lấy model để dựng lại môi trường.
- Mỗi người dùng database local riêng, cùng schema và dữ liệu mẫu; database triển khai dùng chung cho cả ba trang.
- Khi có bộ khung, bổ sung lệnh cài đặt, chạy ứng dụng, tạo dữ liệu mẫu và kiểm tra vào README. Docker Compose là tùy chọn ở giai đoạn đầu.
