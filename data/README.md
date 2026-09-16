# Data

## Format

Mỗi file JSON chứa list các mẫu, mỗi mẫu có cấu trúc:

```json
{
  "text": "1p rau muống + cá viên có cơm thêm rào d6 4838958618 giao 10h",
  "label": [
    {
      "start": 0,
      "end": 2,
      "text": "1p",
      "labels": ["QUANTITY"]
    }
  ]
}
```

| Field | Mô tả |
|-------|--------|
| `text` | Tin nhắn đặt món gốc |
| `label` | Danh sách span annotations |
| `label[].start` | Character offset bắt đầu |
| `label[].end` | Character offset kết thúc |
| `label[].text` | Text của entity |
| `label[].labels` | Loại entity: FOOD, QUANTITY, PLACE, PHONE, TIME, NOTE, PRICE |

## Dữ liệu

- **`sample.json`** — 5 mẫu ví dụ (commit trong repo)
- **Full dataset** (2.325 mẫu) — không commit vào repo

Để train, chuẩn bị 3 file đã chia sẵn:
- `train.json`
- `val.json`
- `test.json`

Đặt vào thư mục `data/` và chạy `scripts/train.py`.

## Hướng dẫn gán nhãn

Xem chi tiết trong [`guidelines.pdf`](./guidelines.pdf).

