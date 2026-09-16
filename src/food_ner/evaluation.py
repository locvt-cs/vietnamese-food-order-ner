"""Đánh giá model NER trên test set."""

import numpy as np
from seqeval.metrics import classification_report

from food_ner.config import id2label


def evaluate(trainer, test_dataset):
    """Chạy prediction trên test set và in classification report.

    Args:
        trainer: Trainer đã train xong.
        test_dataset: Tokenized test dataset.

    Returns:
        str: Classification report (seqeval format).
    """
    predictions, labels, _ = trainer.predict(test_dataset)
    preds = np.argmax(predictions, axis=-1)

    true_labels = [
        [id2label[int(l)] for l in label if l != -100]
        for label in labels
    ]
    true_preds = [
        [id2label[int(p)] for p, l in zip(pred, label) if l != -100]
        for pred, label in zip(preds, labels)
    ]

    report = classification_report(true_labels, true_preds, digits=4)
    print("BẢNG ĐIỂM TRÊN TẬP TEST:")
    print(report)
    return report

