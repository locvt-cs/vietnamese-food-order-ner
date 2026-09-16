"""Tiền xử lý text: clean ký tự đặc biệt + VnCoreNLP word segmentation."""

import re

import py_vncorenlp

from food_ner.config import USER_DICT


def get_segmenter(save_dir):
    """Khởi tạo VnCoreNLP word segmenter.

    Tự động download model nếu thư mục chưa có.

    Args:
        save_dir: Đường dẫn thư mục chứa (hoặc sẽ chứa) model VnCoreNLP.

    Returns:
        VnCoreNLP annotator instance.
    """
    py_vncorenlp.download_model(save_dir=save_dir)
    return py_vncorenlp.VnCoreNLP(annotators=["wseg"], save_dir=save_dir)


def preprocess(raw_text, segmenter):
    """Tiền xử lý text đặt món: clean ký tự đặc biệt → word segment.

    Args:
        raw_text: Chuỗi text gốc từ người dùng.
        segmenter: VnCoreNLP instance từ get_segmenter().

    Returns:
        list[str]: Danh sách token đã segment.
    """
    # Tách ký tự đặc biệt ra thành token riêng
    clean_text = re.sub(r'([.,()!?:+])', r' \1 ', raw_text.replace('_', ' '))
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()

    # Word segmentation
    segmented = segmenter.word_segment(clean_text)

    final_tokens = []
    for sentence in segmented:
        for token in sentence.split():
            if '_' in token:
                parts = token.split('_')
                # Tách compound word nếu chứa từ trong user dict
                if any(part.lower() in USER_DICT for part in parts):
                    final_tokens.extend(parts)
                    continue
            final_tokens.append(token)

    return final_tokens

