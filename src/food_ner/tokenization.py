"""PhoBERT tokenization + căn chỉnh nhãn BIO cho NER."""

from transformers import AutoTokenizer

from food_ner.config import MODEL_NAME, MAX_LEN


def get_tokenizer(model_name=None):
    """Load PhoBERT tokenizer.

    Args:
        model_name: Tên model trên HuggingFace. Mặc định: vinai/phobert-base.

    Returns:
        AutoTokenizer instance.
    """
    return AutoTokenizer.from_pretrained(model_name or MODEL_NAME)


def tokenize_and_align_labels(examples, tokenizer, label2id, max_len=None):
    """Tokenize batch text + căn chỉnh BIO labels với subword tokens.

    Mỗi word được encode thành subwords. Chỉ subword đầu tiên nhận label,
    các subword còn lại nhận -100 (bỏ qua khi tính loss).

    Args:
        examples: Dict với keys "tokens" và "bio_tags" (list[list[str]]).
        tokenizer: PhoBERT tokenizer.
        label2id: Dict mapping label string → int id.
        max_len: Độ dài tối đa sequence. Mặc định: MAX_LEN từ config.

    Returns:
        dict: {"input_ids", "attention_mask", "labels"} — sẵn sàng cho Trainer.
    """
    if max_len is None:
        max_len = MAX_LEN

    tokenized_inputs = {"input_ids": [], "attention_mask": [], "labels": []}

    for i in range(len(examples["tokens"])):
        tokens = examples["tokens"][i]
        tags = examples["bio_tags"][i]

        input_ids = [tokenizer.cls_token_id]
        label_ids = [-100]  # Bỏ qua [CLS] khi tính loss

        for token, tag in zip(tokens, tags):
            word_input_ids = tokenizer.encode(token, add_special_tokens=False)
            input_ids.extend(word_input_ids)
            label_ids.append(label2id[tag])
            label_ids.extend([-100] * (len(word_input_ids) - 1))

        # Truncate (chừa 1 chỗ cho [SEP])
        if len(input_ids) > max_len - 1:
            input_ids = input_ids[:max_len - 1]
            label_ids = label_ids[:max_len - 1]

        input_ids.append(tokenizer.sep_token_id)
        label_ids.append(-100)

        tokenized_inputs["input_ids"].append(input_ids)
        tokenized_inputs["attention_mask"].append([1] * len(input_ids))
        tokenized_inputs["labels"].append(label_ids)

    return tokenized_inputs

