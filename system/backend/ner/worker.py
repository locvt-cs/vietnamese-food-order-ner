"""Persistent JSON-lines worker; reuse existing food_ner without a second HTTP server."""
import contextlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))
# Keep a dedicated protocol handle, then redirect even native JVM stdout to stderr.
protocol = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", buffering=1)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
resources = None


def analyze(text):
    global resources
    # JVM/library startup messages must not corrupt the JSON-lines protocol.
    with contextlib.redirect_stdout(sys.stderr):
        if resources is None:
            import py_vncorenlp
            from food_ner.inference import load_model
            directory = Path(os.environ["VNCORENLP_DIR"])
            if not (directory / "VnCoreNLP-1.2.jar").is_file():
                raise RuntimeError("VnCoreNLP files are missing")
            model, tokenizer, device = load_model(os.environ.get("NER_MODEL") or None)
            segmenter = py_vncorenlp.VnCoreNLP(annotators=["wseg"], save_dir=str(directory))
            resources = (segmenter, model, tokenizer, device)
        from food_ner.inference import predict_long
        segmenter, model, tokenizer, device = resources
        return {"tokens": predict_long(text, model, tokenizer, segmenter, device)}


for line in sys.stdin:
    try:
        result = analyze(json.loads(line)["text"])
    except Exception:
        # No raw exception/configuration/credentials are sent to the client.
        result = {"error": True, "code": "MODEL_UNAVAILABLE"}
    protocol.write(json.dumps(result, ensure_ascii=False) + "\n")
    protocol.flush()
