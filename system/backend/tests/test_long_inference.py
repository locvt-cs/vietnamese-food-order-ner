"""No model downloads: check window coverage/alignment with a deterministic model."""
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'src'))
import torch
from food_ner.inference import predict, predict_long
from food_ner.config import MAX_LEN


class Tokenizer:
    cls_token_id, sep_token_id, unk_token_id = 0, 1, 2

    def encode(self, word, add_special_tokens=False):
        if word == 'giant':
            return [7] * (MAX_LEN * 3)
        return [int(word[1:]) + 3] * (1 + int(word[1:]) % 3)


class Model:
    config = SimpleNamespace(id2label={0: 'B-FOOD', 1: 'I-FOOD'})

    def __init__(self):
        self.window_sizes = []

    def __call__(self, values):
        self.window_sizes.append(values.shape[1])
        return SimpleNamespace(logits=torch.nn.functional.one_hot(values % 2, num_classes=2).float())


class Segmenter:
    def word_segment(self, text):
        return [text]


class LongInferenceTests(unittest.TestCase):
    def test_short_input_matches_existing_inference(self):
        args = (Model(), Tokenizer(), Segmenter(), 'cpu')
        text = ' '.join(f'w{i}' for i in range(20))
        self.assertEqual(predict(text, *args), predict_long(text, *args))

    def test_long_input_keeps_every_word_once_in_order(self):
        words = [f'w{i}' for i in range(1500)]
        model = Model()
        result = predict_long(' '.join(words), model, Tokenizer(), Segmenter(), 'cpu')
        self.assertEqual([item['token'] for item in result], words)
        self.assertEqual([item['label'] for item in result], ['I-FOOD' if (i + 3) % 2 else 'B-FOOD' for i in range(1500)])
        self.assertGreater(len(model.window_sizes), 1)
        self.assertLessEqual(max(model.window_sizes), MAX_LEN)

    def test_one_word_larger_than_window_does_not_drop_following_words(self):
        result = predict_long('w0 giant w1 w2', Model(), Tokenizer(), Segmenter(), 'cpu')
        self.assertEqual([item['token'] for item in result], ['w0', 'giant', 'w1', 'w2'])

    def test_empty_input(self):
        self.assertEqual(predict_long('', Model(), Tokenizer(), Segmenter(), 'cpu'), [])


if __name__ == '__main__':
    unittest.main()
