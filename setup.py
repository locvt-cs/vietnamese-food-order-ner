"""Setup script cho food_ner package."""

from setuptools import setup, find_packages

setup(
    name="food_ner",
    version="0.1.0",
    description="Vietnamese Food Order NER — Trích xuất thông tin đơn hàng từ tin nhắn tiếng Việt",
    author="CS221DoAn",
    python_requires=">=3.9",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    install_requires=[
        "torch",
        "transformers",
        "datasets",
        "seqeval",
        "accelerate",
        "py_vncorenlp",
        "scikit-learn",
        "pandas",
        "numpy",
    ],
)

