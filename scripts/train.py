"""Entry point: Full training pipeline cho Vietnamese Food Order NER."""

import argparse
import json
import os
import shutil
import warnings

import pandas as pd
from datasets import Dataset, DatasetDict

from food_ner.config import label2id
from food_ner.preprocessing import get_segmenter, preprocess
from food_ner.labeling import create_bio_tags
from food_ner.tokenization import get_tokenizer, tokenize_and_align_labels
from food_ner.training import build_model, build_training_args, build_trainer
from food_ner.evaluation import evaluate


def load_split(path):
    """Đọc 1 file JSON dataset và trả về DataFrame."""
    with open(path, "r", encoding="utf-8") as f:
        return pd.DataFrame(json.load(f))


def main():
    parser = argparse.ArgumentParser(
        description="Train Vietnamese Food Order NER model",
    )
    parser.add_argument("--train", required=True, help="Đường dẫn file train.json")
    parser.add_argument("--val", required=True, help="Đường dẫn file val.json")
    parser.add_argument("--test", required=True, help="Đường dẫn file test.json")
    parser.add_argument("--output", default="./output", help="Thư mục output")
    parser.add_argument(
        "--vncorenlp-dir", required=True,
        help="Thư mục chứa model VnCoreNLP",
    )
    args = parser.parse_args()

    warnings.filterwarnings("ignore")
    os.environ["TRANSFORMERS_VERBOSITY"] = "error"

    # ── 1. Tạo thư mục output ───────────────────────────────────────────────
    checkpoints_dir = os.path.join(args.output, "checkpoints")
    model_dir = os.path.join(args.output, "final_model")
    os.makedirs(checkpoints_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    # ── 2. Đọc data (đã chia sẵn train/val/test) ────────────────────────────
    print("Đọc dữ liệu...")
    train_df = load_split(args.train)
    val_df = load_split(args.val)
    test_df = load_split(args.test)
    print(f"  Train: {len(train_df)} | Val: {len(val_df)} | Test: {len(test_df)}")

    # ── 3. Tiền xử lý text ──────────────────────────────────────────────────
    print("Tiền xử lý text...")
    segmenter = get_segmenter(args.vncorenlp_dir)
    for df in [train_df, val_df, test_df]:
        df["tokens"] = df["text"].apply(lambda t: preprocess(t, segmenter))

    # ── 4. Tạo BIO tags ─────────────────────────────────────────────────────
    print("Tạo BIO tags...")
    for df in [train_df, val_df, test_df]:
        df["bio_tags"] = df.apply(
            lambda row: create_bio_tags(row["text"], row["tokens"], row["label"]),
            axis=1,
        )

    # ── 5. Đóng gói DatasetDict ─────────────────────────────────────────────
    datasets = DatasetDict({
        "train": Dataset.from_dict({
            "tokens": train_df["tokens"].tolist(),
            "bio_tags": train_df["bio_tags"].tolist(),
        }),
        "validation": Dataset.from_dict({
            "tokens": val_df["tokens"].tolist(),
            "bio_tags": val_df["bio_tags"].tolist(),
        }),
        "test": Dataset.from_dict({
            "tokens": test_df["tokens"].tolist(),
            "bio_tags": test_df["bio_tags"].tolist(),
        }),
    })

    # ── 6. Tokenize + align labels ───────────────────────────────────────────
    print("Tokenize + align labels...")
    tokenizer = get_tokenizer()
    tokenized_datasets = datasets.map(
        lambda ex: tokenize_and_align_labels(ex, tokenizer, label2id),
        batched=True,
        remove_columns=datasets["train"].column_names,
    )

    # ── 7. Train ─────────────────────────────────────────────────────────────
    print("Bắt đầu training...")
    model = build_model()
    training_args = build_training_args(checkpoints_dir)
    trainer = build_trainer(
        model, training_args,
        tokenized_datasets["train"],
        tokenized_datasets["validation"],
        tokenizer,
    )
    trainer.train()

    # ── 8. Lưu model tốt nhất ───────────────────────────────────────────────
    print(f"Lưu model vào {model_dir}...")
    trainer.save_model(model_dir)

    # ── 9. Đánh giá trên test set ───────────────────────────────────────────
    print("Đánh giá trên test set...")
    evaluate(trainer, tokenized_datasets["test"])

    # ── 10. Dọn dẹp checkpoints ─────────────────────────────────────────────
    if os.path.exists(checkpoints_dir):
        shutil.rmtree(checkpoints_dir)
        print(f"Đã xóa checkpoints: {checkpoints_dir}")

    print("Hoàn tất!")


if __name__ == "__main__":
    main()

