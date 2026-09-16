# Vietnamese Food Order NER

Trích xuất thông tin có cấu trúc từ tin nhắn đặt món tiếng Việt sử dụng **PhoBERT fine-tuned** trên tập dữ liệu 2.325 tin nhắn.

## Thực thể nhận diện

| Entity | Mô tả | Ví dụ |
|--------|-------|-------|
| `FOOD` | Tên món ăn | rau muống, cá viên, bò xào bông cải |
| `QUANTITY` | Số lượng | 1p, 2 phần |
| `PLACE` | Địa điểm giao | rào d6, khu A |
| `PHONE` | Số điện thoại | 0794987xxx |
| `TIME` | Thời gian giao | 10h, 10g30 |
| `NOTE` | Ghi chú | thêm, nhiều |
| `PRICE` | Giá tiền | 50k |

## Cài đặt

```bash
# Clone repo
git clone https://github.com/CS221DoAn/vietnamese-food-order-ner.git
cd vietnamese-food-order-ner

# Cài đặt dependencies
pip install -r requirements.txt

# Cài đặt package (development mode)
pip install -e .
```

## Quick Start — Inference

```python
from food_ner import load_model, predict, format_prediction
from food_ner.preprocessing import get_segmenter

# Khởi tạo
segmenter = get_segmenter("/path/to/vncorenlp")
model, tokenizer, device = load_model()

# Predict
results = predict(
    "1p rau muống + cá viên, giao rào d6, 0794987xxx, lúc 10h",
    model, tokenizer, segmenter, device,
)
print(format_prediction(results))
```

Hoặc chạy qua CLI:

```bash
python scripts/predict.py \
    --text "1p rau muống giao rào d6" \
    --vncorenlp-dir /path/to/vncorenlp
```

## Training

```bash
python scripts/train.py \
    --train data/train.json \
    --val data/val.json \
    --test data/test.json \
    --output ./output \
    --vncorenlp-dir /path/to/vncorenlp
```

## Cấu trúc dự án

```
├── src/food_ner/          # Core package
│   ├── config.py          # Constants, label schema, hyperparameters
│   ├── preprocessing.py   # Text cleaning + VnCoreNLP segmentation
│   ├── labeling.py        # BIO tag generation
│   ├── tokenization.py    # PhoBERT tokenize + label alignment
│   ├── training.py        # Model, Trainer, metrics
│   ├── evaluation.py      # Test set evaluation
│   └── inference.py       # Load model + predict
├── scripts/               # Entry points
│   ├── train.py           # Full training pipeline
│   └── predict.py         # Demo inference
├── data/                  # Dataset (chỉ commit sample)
│   └── sample.json        # 5 mẫu ví dụ
└── notebooks/             # Notebook tham khảo
    └── phobert.ipynb      # Notebook gốc
```

## Model

Model đã fine-tune được lưu trên HuggingFace Hub:
**[CS221DoAn/vietnamese_food_order_extraction](https://huggingface.co/CS221DoAn/vietnamese_food_order_extraction)**

