"""Khởi tạo model, training arguments, và Trainer cho PhoBERT NER."""

import numpy as np
from transformers import (
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForTokenClassification,
)
from seqeval.metrics import (
    precision_score,
    recall_score,
    f1_score,
    accuracy_score,
)

from food_ner.config import (
    MODEL_NAME,
    NUM_LABELS,
    label2id,
    id2label,
    LEARNING_RATE,
    BATCH_SIZE,
    NUM_EPOCHS,
    WEIGHT_DECAY,
)


def compute_metrics(eval_pred):
    """Tính precision, recall, f1, accuracy qua seqeval.

    Args:
        eval_pred: Tuple (predictions, labels) từ Trainer.

    Returns:
        dict: {"precision", "recall", "f1", "accuracy"}.
    """
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=-1)

    true_predictions = [
        [id2label[int(pred)] for pred, lbl in zip(prediction, label) if lbl != -100]
        for prediction, label in zip(predictions, labels)
    ]
    true_labels = [
        [id2label[int(lbl)] for pred, lbl in zip(prediction, label) if lbl != -100]
        for prediction, label in zip(predictions, labels)
    ]

    return {
        "precision": precision_score(true_labels, true_predictions),
        "recall": recall_score(true_labels, true_predictions),
        "f1": f1_score(true_labels, true_predictions),
        "accuracy": accuracy_score(true_labels, true_predictions),
    }


def build_model(model_name=None):
    """Khởi tạo PhoBERT cho token classification.

    Args:
        model_name: Tên model pretrained. Mặc định: vinai/phobert-base.

    Returns:
        AutoModelForTokenClassification instance.
    """
    return AutoModelForTokenClassification.from_pretrained(
        model_name or MODEL_NAME,
        num_labels=NUM_LABELS,
        id2label=id2label,
        label2id=label2id,
    )


def build_training_args(output_dir, **overrides):
    """Tạo TrainingArguments với defaults từ config, cho phép override.

    Args:
        output_dir: Thư mục lưu checkpoints.
        **overrides: Override bất kỳ tham số nào (vd: num_train_epochs=5).

    Returns:
        TrainingArguments instance.
    """
    defaults = dict(
        output_dir=output_dir,
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=LEARNING_RATE,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        num_train_epochs=NUM_EPOCHS,
        weight_decay=WEIGHT_DECAY,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        save_total_limit=2,
        report_to="none",
    )
    defaults.update(overrides)
    return TrainingArguments(**defaults)


def build_trainer(model, args, train_dataset, val_dataset, tokenizer):
    """Tạo HuggingFace Trainer.

    Args:
        model: Model đã khởi tạo từ build_model().
        args: TrainingArguments từ build_training_args().
        train_dataset: Tokenized training dataset.
        val_dataset: Tokenized validation dataset.
        tokenizer: PhoBERT tokenizer.

    Returns:
        Trainer instance sẵn sàng .train().
    """
    data_collator = DataCollatorForTokenClassification(tokenizer)
    return Trainer(
        model=model,
        args=args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        processing_class=tokenizer,
        compute_metrics=compute_metrics,
    )

