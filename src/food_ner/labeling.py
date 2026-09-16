"""Tạo BIO tags từ span annotations."""


def get_tag(tok_start, spans, seen):
    """Xác định BIO tag cho 1 token dựa vào vị trí character.

    Args:
        tok_start: Vị trí bắt đầu (character offset) của token trong text gốc.
        spans: List các span đã sort: [(start, end, entity_type), ...].
        seen: Set các span index đã gặp (dùng phân biệt B- vs I-).

    Returns:
        str: BIO tag (vd: "B-FOOD", "I-FOOD", "O").
    """
    for i, (s, e, etype) in enumerate(spans):
        if s <= tok_start < e:
            prefix = 'I' if i in seen else 'B'
            seen.add(i)
            return f'{prefix}-{etype}'
    return 'O'


def create_bio_tags(text, tokens, labels):
    """Tạo chuỗi BIO tags cho 1 mẫu dữ liệu.

    Args:
        text: Raw text gốc.
        tokens: List token đã segment (từ preprocessing).
        labels: List span annotations, mỗi span có keys:
                "start", "end", "labels" (list entity types).

    Returns:
        list[str]: BIO tags tương ứng với từng token.
    """
    spans = sorted(
        [(a['start'], a['end'], a['labels'][0]) for a in labels],
        key=lambda x: x[0],
    )
    seen, cursor, tags = set(), 0, []

    for tok in tokens:
        search_tok = tok.replace('_', ' ')
        idx = text.find(search_tok, cursor)
        if idx == -1:
            tags.append('O')
            continue
        cursor = idx + len(search_tok)
        tags.append(get_tag(idx, spans, seen))

    return tags

