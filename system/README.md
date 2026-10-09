# Manage — ứng dụng quản lý đơn món ăn

Ưu tiên chức năng trước: nhập văn bản → NER → chỉnh thực thể → xác nhận → lưu MongoDB → mở lại và sửa khi còn chờ nấu. Kitchen và Delivery chỉ là tab giữ chỗ. Chưa có sáng/tối, print, ghi âm, animation hoặc shadow.

## 1. Kiến trúc và cấu trúc hiện tại

- **React + Tailwind + Vite**: giao diện ba tab, triển khai chức năng Manage.
- **Node.js + Express + MongoDB Node.js Driver**: API và lưu trữ; không dùng Mongoose hoặc FastAPI.
- **Python worker**: tái sử dụng `src/food_ner`, giữ model trong một tiến trình, không tải/nạp lại theo từng yêu cầu. Không cần thêm Python HTTP server.
- Một `package.json`, một `package-lock.json` và một `node_modules` ở `system/` dùng chung frontend/backend. Python tái sử dụng môi trường `env` hiện có ở thư mục workspace.

```text
system/
├── package.json                 # Dependencies + lệnh chạy chung
├── package-lock.json            # Khóa phiên bản npm; commit cùng package.json
├── vite.config.js               # React, Tailwind, proxy /api về port 3001
├── .env.example                 # Cấu hình mẫu, không có credentials
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx              # Ba tab; giữ bản nháp khi chuyển tab
│   │   ├── main.jsx
│   │   ├── styles.css           # Tailwind, style tối giản
│   │   ├── shared/
│   │   │   ├── api.js           # Gọi API, timeout, thông báo lỗi
│   │   │   └── Icon.jsx         # SVG cơ bản; không thêm thư viện icon
│   │   └── features/manage/
│   │       ├── ManagePage.jsx   # Bố cục danh sách, hội thoại, ô nhập
│   │       └── useManage.js     # Bản nháp, phân tích, xác nhận, mở đơn
│   └── tests/manage.spec.js     # Kiểm tra trình duyệt bằng API giả riêng
├── backend/
│   ├── src/
│   │   ├── server.js            # Cấu hình, kết nối MongoDB, mở API
│   │   ├── app.js               # Các endpoint HTTP
│   │   ├── domain.js            # Validate dữ liệu, gộp thực thể BIO
│   │   ├── orders.js            # Nghiệp vụ + repository MongoDB
│   │   └── ner.js               # Quản lý worker Python và hàng đợi
│   ├── ner/worker.py            # Gọi code NER hiện có qua JSON-lines
│   ├── tests/orders.test.js
│   └── requirements-inference.txt
├── scripts/
│   ├── prepare_ner.py           # Chuẩn bị đúng tài nguyên suy luận cần dùng
│   └── check-ner.js             # Kiểm tra NER độc lập, không đọc credentials
├── docs/order-contract.md       # Hợp đồng dữ liệu/API dùng chung
├── playwright.config.js        # Dùng Edge có sẵn, không tải browser riêng
└── README.md
```

`node_modules/`, `.cache/`, `frontend/dist/` và kết quả test sinh ra tại máy, không commit.

## 2. Thao tác lần lượt trên Windows / PowerShell

### Bước 1 — vào đúng thư mục, kiểm tra môi trường

```powershell
cd D:\PPJ\food_extraction\vietnamese-food-order-ner\system
node --version
npm --version
..\..\env\Scripts\python.exe --version
java -version
```

Dùng Node.js từ 22.12 trở lên và Java 64-bit để chạy VnCoreNLP. Môi trường Python hiện có được dùng trực tiếp, không cần activate hoặc tạo môi trường thứ hai. Máy khác có thể tạo một môi trường riêng rồi cấu hình `PYTHON_EXECUTABLE`.

### Bước 2 — cài package một lần tại `system/`

```powershell
npm ci
..\..\env\Scripts\python.exe -m pip install -r backend/requirements-inference.txt
```

`npm ci` dùng lockfile đã có. Nếu máy đã cài và dependencies không đổi thì bỏ qua bước này; không chạy lại sau mỗi lần pull. Không chạy `npm install` riêng trong frontend và backend.

| Package | Mục đích |
| --- | --- |
| react, react-dom | Giao diện |
| express, mongodb | API và MongoDB Driver |
| vite, @vitejs/plugin-react | Chạy dev/build frontend |
| tailwindcss, @tailwindcss/vite | CSS và căn chỉnh |
| @playwright/test | Kiểm tra thao tác UI bằng Edge đã có |
| torch, transformers, py_vncorenlp | Suy luận NER bằng Python |

Không cài lại `requirements.txt` ở gốc chỉ để chạy web: file đó còn chứa dependencies huấn luyện không cần ở đây.

### Bước 3 — chuẩn bị model một lần

Nếu chưa có model và VnCoreNLP:

```powershell
..\..\env\Scripts\python.exe scripts/prepare_ner.py
```

Script chỉ tải JAR và hai file word segmentation của VnCoreNLP vào `system/.cache/vncorenlp`. PhoBERT dùng cache Hugging Face hiện có; không tạo bản sao theo trang. File đã có được tái sử dụng. Đây là bước cần mạng; gọi API mặc định chỉ dùng model local.

Nếu đã có VnCoreNLP ở nơi khác, dùng đường dẫn đó khi chuẩn bị và trong cấu hình:

```powershell
..\..\env\Scripts\python.exe scripts/prepare_ner.py --vncorenlp-dir D:\models\vncorenlp
```

Không cần chạy script nếu toàn bộ tài nguyên đã sẵn sàng. Có thể đặt `NER_MODEL` thành đường dẫn tuyệt đối tới checkpoint local thay cho model ID trên Hub.

### Bước 4 — cấu hình tại máy, không push thông tin bí mật

Tạo cấu hình local khi chưa có:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Tự chỉnh `system/.env`:

```dotenv
MONGODB_URI=
MONGODB_DB=food_orders_dev
PORT=3001
PYTHON_EXECUTABLE=../../env/Scripts/python.exe
VNCORENLP_DIR=.cache/vncorenlp
NER_MODEL=CS221DoAn/vietnamese_food_order_extraction
NER_LOCAL_FILES_ONLY=true
```

Có hai cách cung cấp connection string:

- Tự điền `MONGODB_URI` trong `.env` local.
- Giữ credentials ở `D:\PPJ\food_extraction\atlas-credentials.env`, rồi tự chạy Node với `--env-file` ở bước 5. Code không tự tìm hoặc đọc file credentials bên ngoài. Nếu tên biến chứa URI khác `MONGODB_URI`, đặt `MONGODB_URI_ENV` bằng **tên biến đó**. Cần URI `mongodb://` hoặc `mongodb+srv://`, không phải Atlas API key.

Không gửi URI vào chat/PR. Các biến MongoDB chỉ ở backend, không đặt tiền tố `VITE_`. Đường dẫn Python/VnCoreNLP trong `.env` tính từ `system/`. Nếu đổi port API, cập nhật proxy trong `vite.config.js` cho khớp.

Mỗi người dùng database phát triển riêng để tránh thay đổi đơn của nhau; cùng dùng schema và code. Khi chạy một bản ứng dụng chung, ba trang dùng chung database đó.

### Bước 5 — chạy backend, rồi frontend

**Terminal 1**, đứng ở `system/`, khi URI đã nằm trong `.env` hoặc biến môi trường:

```powershell
npm run dev:api
```

Nếu tự nạp file credentials bên ngoài, dùng lệnh này **thay cho** lệnh trên:

```powershell
node --env-file=../../atlas-credentials.env --watch backend/src/server.js
```

Nếu tên biến URI khác, đặt tên biến trước khi chạy, ví dụ:

```powershell
$env:MONGODB_URI_ENV = "TEN_BIEN_CHUA_CONNECTION_STRING"
```

Backend chạy tại `http://127.0.0.1:3001`. Chưa có cấu hình/kết nối MongoDB thì backend báo lỗi và dừng, không tự dùng database giả.

**Terminal 2**, cũng đứng ở `system/`:

```powershell
npm run dev
```

Mở địa chỉ Vite in trong terminal, thường là `http://127.0.0.1:5173`. Frontend gọi `/api` qua proxy; không cần thêm package CORS. Dừng từng tiến trình bằng `Ctrl+C`.

### Bước 6 — kiểm tra logic trước khi chỉnh UI

```powershell
npm test
npm run build
npm run test:ui
npm run check:ner
```

- `npm test`: validate, lưu/sửa, chống xác nhận trùng, chặn trạng thái/phiên bản xung đột và luồng HTTP; dùng repository trong bộ nhớ của test, không kiểm tra Atlas thật.
- `npm run build`: kiểm tra build frontend.
- `npm run test:ui`: kiểm tra thao tác bằng Edge headless với API giả riêng; không dùng MongoDB hoặc model thật, không tải browser mới.
- `npm run check:ner`: gọi model thật, độc lập với MongoDB; đọc cấu hình từ biến môi trường và các đường dẫn mặc định, không tự đọc `.env` hay file credentials. Với đường dẫn khác, export `PYTHON_EXECUTABLE`, `VNCORENLP_DIR`, `NER_MODEL` trước khi chạy.

Sau đó kiểm tra trực tiếp với backend/model/MongoDB thật:

1. Gửi `2 phần cơm gà giao khu A số điện thoại 0901234567`.
2. Kiểm tra các ô thực thể, chỉnh nội dung; thêm hoặc xóa thực thể nếu model nhận thiếu/sai.
3. Gửi thêm yêu cầu trong cùng hội thoại. Mỗi kết quả phải có cặp **Discard / Confirm riêng**.
4. Discard một kết quả: bỏ đúng cặp yêu cầu/kết quả đó. Các kết quả khác giữ nguyên.
5. Confirm: lưu đơn **Chờ nấu**, đưa lên đầu danh sách. Cần có ít nhất một `FOOD` và không có ô thực thể rỗng.
6. Tạo đơn khác, rồi bấm bút chì ở đơn cũ: hội thoại và thực thể đã lưu được nạp lại. Sửa và Confirm cập nhật **cùng mã đơn**, đưa đơn lên đầu.
7. Tải lại trình duyệt và mở đơn để kiểm tra dữ liệu đã lưu thật. Bản nháp chưa Confirm không được lưu khi tải lại trang.
8. Khi backend ghi trạng thái `PREPARING`, Manage chỉ cho xem. Kiểm tra này đã có trong test; chưa có UI Kitchen để chuyển trạng thái.

## 3. Quy tắc Manage đã triển khai

- Thanh trên có Manage/Kitchen/Delivery. Chuyển tab không làm mất bản nháp trong phiên đang mở.
- Ô nhập nằm dưới khu vực hội thoại; micro bị vô hiệu hóa và có nhãn giữ chỗ. Nút gửi mũi tên nằm ngoài ô nhập. Hỗ trợ `Ctrl+Enter`.
- Kết quả NER gộp nhãn BIO thành thực thể, mỗi ô có tên nhãn và màu pastel. Có thể sửa, thêm hoặc xóa thực thể trước khi xác nhận.
- Mỗi hội thoại tương ứng một đơn. Confirm một kết quả chọn bộ thực thể của kết quả đó làm nội dung đơn; không tự cộng dồn các kết quả khác. Lịch sử hiện còn trong hội thoại được lưu cùng đơn.
- Discard xóa cặp yêu cầu/kết quả khỏi bản nháp, không xóa đơn đã lưu trong database. Các sửa đổi chỉ được lưu khi Confirm một kết quả còn lại.
- Danh sách ưu tiên `PHONE`, `PLACE`; tối đa năm thực thể trên mỗi thẻ, nội dung dài rút gọn và hiện đầy đủ qua tooltip. Mỗi lần lấy 50 đơn, có nút xem thêm.
- Đơn mới và đơn vừa sửa Confirm lên đầu. Danh sách tự cập nhật mỗi 5 giây, có nút làm mới thủ công.
- Chỉ sửa khi `status = WAITING`. API ghi có điều kiện theo cả status và version để tránh ghi đè khi hai người sửa hoặc bếp vừa nhận đơn.
- Gửi lại cùng lần Confirm sau lỗi mạng không tạo thêm đơn. Khi xung đột, tải lại bản đã lưu rồi sửa tiếp.
- Giới hạn 1.000 ký tự/yêu cầu, 20 kết quả/hội thoại, 100 thực thể/kết quả. Nếu vượt giới hạn token của model, API yêu cầu rút gọn thay vì âm thầm cắt đơn.

## 4. Phân công và thứ tự phát triển tiếp

| Phụ trách | Phạm vi full stack |
| --- | --- |
| Người A | Manage: UI, API phân tích/xác nhận/sửa, dữ liệu và test |
| Người B | Kitchen và Delivery: UI, API nghiệp vụ, dữ liệu và test khi triển khai các module này |
| Người A và người B | Hợp đồng đơn hàng, phần dùng chung, review chéo, kiểm tra luồng xuyên suốt |

Thứ tự làm việc: **cài đúng dependencies → chốt hợp đồng dữ liệu → viết nghiệp vụ/API và test → nối UI tối giản → kiểm tra luồng thật → tối ưu UI cuối cùng**.

Làm bất đồng bộ qua Git:

1. Lấy `main` mới nhất, tạo nhánh cho một việc nhỏ, ví dụ `feat/manage-edit-order`.
2. Viết code và kiểm tra, commit, push nhánh, mở PR. Không cần chờ người còn lại online.
3. PR ghi: đã làm gì, cách thử, ảnh hưởng API/schema và phần còn thiếu. Người còn lại review khi có thời gian.
4. Sửa theo review, kiểm tra rồi merge. Nếu reviewer sửa trực tiếp cùng nhánh thì trao đổi trước; không force-push nhánh dùng chung.
5. Đồng bộ `main` trước công việc tiếp theo. Chỉ chạy lại bước cài khi dependencies thay đổi. Có thể làm phần độc lập trong lúc chờ review.

Thêm package phải có mục đích rõ ràng và commit cả manifest/lockfile. Không tạo project React/Node hoặc bản sao model riêng cho Kitchen/Delivery. Khi nghiệp vụ mở rộng mới tách thêm router/service, không dựng thư mục rỗng trước.

Tham khảo triển khai: [Tailwind với Vite](https://tailwindcss.com/docs/installation/using-vite), [MongoDB compound operations](https://www.mongodb.com/docs/drivers/node/current/crud/compound-operations/).
