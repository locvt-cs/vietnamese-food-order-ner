"""Hằng số, label schema, và hyperparameters cho Vietnamese Food Order NER."""

# ── Model ────────────────────────────────────────────────────────────────────
MODEL_NAME = "vinai/phobert-base"
HF_MODEL_ID = "CS221DoAn/vietnamese_food_order_extraction"
MAX_LEN = 256

# ── Entity types & BIO tagging scheme ────────────────────────────────────────
ENTITY_TYPES = ["QUANTITY", "FOOD", "NOTE", "PLACE", "PHONE", "TIME", "PRICE"]
BIO_TAGS = ["O"] + [f"B-{e}" for e in ENTITY_TYPES] + [f"I-{e}" for e in ENTITY_TYPES]

_unique_tags = sorted(set(BIO_TAGS))
label2id = {tag: i for i, tag in enumerate(_unique_tags)}
id2label = {i: tag for tag, i in label2id.items()}
NUM_LABELS = len(_unique_tags)

# ── Từ điển tách riêng khi word segmentation (tránh VnCoreNLP ghép sai) ──────
USER_DICT = {"a", "giao"}

# ── Training hyperparameters ─────────────────────────────────────────────────
LEARNING_RATE = 2e-5
BATCH_SIZE = 16
NUM_EPOCHS = 10
WEIGHT_DECAY = 0.01

