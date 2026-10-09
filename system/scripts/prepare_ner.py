"""Download only inference resources once. Never reads MongoDB credential files."""
import argparse
import os
from pathlib import Path
from urllib.request import urlopen
import shutil
import sys
import threading

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--vncorenlp-dir', type=Path, default=ROOT / '.cache' / 'vncorenlp')
parser.add_argument('--model', default='CS221DoAn/vietnamese_food_order_extraction')
parser.add_argument('--timeout', type=int, default=300, help='Maximum seconds for preparing model weights')
args = parser.parse_args()

# The application uses wseg only; no POS, dependency parser or VnCoreNLP NER models.
base = 'https://raw.githubusercontent.com/vncorenlp/VnCoreNLP/master/'
for name in ['VnCoreNLP-1.2.jar', 'models/wordsegmenter/vi-vocab', 'models/wordsegmenter/wordsegmenter.rdr']:
    target = args.vncorenlp_dir.resolve() / name
    if target.is_file() and target.stat().st_size:
        print(f'Already available: {name}')
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + '.part')
    print(f'Downloading: {name}', flush=True)
    with urlopen(base + name, timeout=60) as response, temporary.open('wb') as output:
        shutil.copyfileobj(response, output)
    temporary.replace(target)

sys.path.insert(0, str(ROOT.parent / 'src'))
from food_ner.inference import load_model
print('Preparing PhoBERT in the shared Hugging Face cache...', flush=True)

def timed_out():
    print('Model preparation timed out. Check the network and rerun to reuse cached files.', file=sys.stderr, flush=True)
    os._exit(1)

timer = threading.Timer(args.timeout, timed_out)
timer.daemon = True
timer.start()
try:
    load_model(args.model, device='cpu')
finally:
    timer.cancel()
print(f'Ready. Set VNCORENLP_DIR={args.vncorenlp_dir.resolve()}')
