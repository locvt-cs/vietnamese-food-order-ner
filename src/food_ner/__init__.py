"""Vietnamese Food Order NER — Trích xuất thông tin đơn hàng từ tin nhắn tiếng Việt.

Sử dụng PhoBERT fine-tuned để nhận diện 7 loại thực thể:
FOOD, PLACE, QUANTITY, PHONE, NOTE, TIME, PRICE.

Quick start:
    from food_ner import load_model, predict
    from food_ner.preprocessing import get_segmenter

    segmenter = get_segmenter("/path/to/vncorenlp")
    model, tokenizer, device = load_model()
    results = predict("1p rau muống giao rào d6", model, tokenizer, segmenter, device)
"""

from food_ner.inference import load_model, predict, format_prediction

__all__ = ["load_model", "predict", "format_prediction"]

