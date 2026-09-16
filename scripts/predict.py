"""Entry point: Demo inference cho Vietnamese Food Order NER."""

import argparse

from food_ner.preprocessing import get_segmenter
from food_ner.inference import load_model, predict, format_prediction


def main():
    parser = argparse.ArgumentParser(
        description="Predict NER entities từ tin nhắn đặt món",
    )
    parser.add_argument("--text", required=True, help="Tin nhắn đặt món")
    parser.add_argument(
        "--model", default=None,
        help="Model ID hoặc local path (mặc định: HuggingFace Hub)",
    )
    parser.add_argument(
        "--vncorenlp-dir", required=True,
        help="Thư mục chứa model VnCoreNLP",
    )
    args = parser.parse_args()

    # Load resources
    segmenter = get_segmenter(args.vncorenlp_dir)
    model, tokenizer, device = load_model(args.model)

    # Predict
    print(f"\nOrder: {args.text}\n")
    results = predict(args.text, model, tokenizer, segmenter, device)
    print(format_prediction(results))


if __name__ == "__main__":
    main()

