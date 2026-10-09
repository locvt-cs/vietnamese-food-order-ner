"""Load model từ HuggingFace Hub và predict NER entities."""

import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification

from food_ner.config import HF_MODEL_ID, MAX_LEN
from food_ner.preprocessing import preprocess


def load_model(model_id=None, device=None):
    """Load model + tokenizer từ HuggingFace Hub hoặc local path.

    Args:
        model_id: Model ID trên HuggingFace hoặc đường dẫn local.
                  Mặc định: CS221DoAn/vietnamese_food_order_extraction.
        device: torch.device. Mặc định: auto-detect GPU/CPU.

    Returns:
        tuple: (model, tokenizer, device).
    """
    if model_id is None:
        model_id = HF_MODEL_ID
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = AutoModelForTokenClassification.from_pretrained(model_id).to(device)
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    return model, tokenizer, device


def predict(text, model, tokenizer, segmenter, device):
    """Predict NER entities từ text đặt món.

    Args:
        text: Chuỗi tin nhắn đặt món.
        model: Model đã load.
        tokenizer: Tokenizer đã load.
        segmenter: VnCoreNLP instance.
        device: torch.device.

    Returns:
        list[dict]: Mỗi dict có {"token": str, "label": str}.
                    Ví dụ: [{"token": "rau_muống", "label": "B-FOOD"}, ...]
    """
    # Tiền xử lý
    tokens = preprocess(text, segmenter)

    # Tokenize
    input_ids = [tokenizer.cls_token_id]
    word_ids = [None]

    for i, word in enumerate(tokens):
        sub_ids = tokenizer.encode(word, add_special_tokens=False)
        input_ids.extend(sub_ids)
        word_ids.extend([i] * len(sub_ids))

    # Truncate
    if len(input_ids) > MAX_LEN - 1:
        input_ids = input_ids[:MAX_LEN - 1]
        word_ids = word_ids[:MAX_LEN - 1]

    input_ids.append(tokenizer.sep_token_id)
    word_ids.append(None)

    # Predict
    inputs = torch.tensor([input_ids]).to(device)
    with torch.no_grad():
        preds = model(inputs).logits.argmax(dim=-1)[0].tolist()

    # Thu thập kết quả (chỉ lấy subword đầu tiên cho mỗi từ)
    results = []
    prev_idx = None
    for i, idx in enumerate(word_ids):
        if idx is not None and idx != prev_idx:
            label = model.config.id2label.get(
                str(preds[i]),
                model.config.id2label.get(preds[i], "O"),
            )
            results.append({"token": tokens[idx], "label": label})
            prev_idx = idx

    return results


def predict_long(text, model, tokenizer, segmenter, device, overlap=32):
    """Infer every word using overlapping windows; never truncate long orders.

    Each word is emitted once in source order. For words seen in two windows,
    use the prediction with more context on both sides. Even a single word
    longer than one window is preserved in full in the output.
    """
    tokens = preprocess(text, segmenter)
    if not tokens:
        return []
    capacity = MAX_LEN - 2
    if not 0 <= overlap < capacity:
        raise ValueError("overlap must be smaller than the window capacity")
    input_ids, word_starts = [], {}
    for index, word in enumerate(tokens):
        word_starts[len(input_ids)] = index
        input_ids.extend(tokenizer.encode(word, add_special_tokens=False) or [tokenizer.unk_token_id])

    predictions = {}
    step = capacity - overlap
    for start in range(0, len(input_ids), step):
        end = min(start + capacity, len(input_ids))
        window = [tokenizer.cls_token_id, *input_ids[start:end], tokenizer.sep_token_id]
        with torch.no_grad():
            ids = model(torch.tensor([window]).to(device)).logits.argmax(dim=-1)[0].tolist()
        for position in range(start, end):
            word_index = word_starts.get(position)
            if word_index is None:
                continue
            context = min(position - start, end - 1 - position)
            if word_index not in predictions or context > predictions[word_index][0]:
                label_id = ids[position - start + 1]
                label = model.config.id2label.get(str(label_id), model.config.id2label.get(label_id, "O"))
                predictions[word_index] = (context, label)
        if end == len(input_ids):
            break
    return [{"token": word, "label": predictions[index][1]} for index, word in enumerate(tokens)]


def format_prediction(results):
    """Format kết quả predict thành bảng token | label.

    Args:
        results: Output từ predict().

    Returns:
        str: Bảng đã format sẵn để print.
    """
    lines = [f"{'TOKEN':<20} | LABEL", "-" * 35]
    for r in results:
        lines.append(f"{r['token']:<20} | {r['label']}")
    return "\n".join(lines)

