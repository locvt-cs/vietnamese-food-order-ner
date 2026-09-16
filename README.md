# Vietnamese Food Order NER

Trích xuất thông tin có cấu trúc từ tin nhắn đặt món tiếng Việt sử dụng **PhoBERT fine-tuned** trên tập dữ liệu 2.325 tin nhắn.

## Thực thể nhận diện

| Entity | Mô tả | Ví dụ |
|--------|-------|-------|
| `FOOD` | Tên món ăn | rau muống, cá viên |
| `QUANTITY` | Số lượng | 1p, 2 phần |
| `PLACE` | Địa điểm giao | rào d6, khu A |
| `PHONE` | Số điện thoại | 0123456789 |
| `TIME` | Thời gian giao | 10h, 10g30 |
| `NOTE` | Ghi chú | thêm, không |
| `PRICE` | Giá tiền | 20k |

## Cài đặt

```bash
# Clone repo
git clone https://github.com/locvt-cs/vietnamese-food-order-ner.git
cd vietnamese-food-order-ner

# Cài đặt dependencies
pip install -r requirements.txt

# Cài đặt package (development mode)
pip install -e .
```

## Cấu trúc dự án

```
vietnamese-food-order-ner/
├── src/food_ner/            # Core package
│   ├── __init__.py          # Public API: load_model, predict
│   ├── config.py            # Constants, label schema, hyperparameters
│   ├── preprocessing.py     # Text cleaning + VnCoreNLP segmentation
│   ├── labeling.py          # BIO tag generation
│   ├── tokenization.py      # PhoBERT tokenize + label alignment
│   ├── training.py          # Model, Trainer, metrics
│   ├── evaluation.py        # Test set evaluation
│   └── inference.py         # Load model + predict
├── scripts/                 # Entry points
│   ├── train.py             # Full training pipeline
│   └── predict.py           # Demo inference
├── data/                    # Dataset (chỉ commit sample)
│   ├── sample.json          # 5 mẫu ví dụ
│   ├── guidelines.pdf       # Hướng dẫn gán nhãn
│   └── README.md            # Mô tả format dữ liệu
├── requirements.txt
├── setup.py
└── .gitignore
```

## Model

Model đã fine-tune được lưu trên HuggingFace Hub:
**[CS221DoAn/vietnamese_food_order_extraction](https://huggingface.co/CS221DoAn/vietnamese_food_order_extraction)**

