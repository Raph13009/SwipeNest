from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.config import settings


@lru_cache(maxsize=1)
def load_listings() -> list[dict]:
    path = settings.processed_dir / "listings.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run: python scripts/prepare_dataset.py"
        )
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_meta() -> dict:
    with open(settings.processed_dir / "meta.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_rent_refs() -> dict:
    with open(settings.processed_dir / "rent_references.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_embeddings() -> tuple[np.ndarray, np.ndarray, list[str]]:
    text = np.load(settings.embeddings_dir / "text_embeddings.npy")
    visual = np.load(settings.embeddings_dir / "visual_features.npy")
    with open(settings.embeddings_dir / "listing_ids.json") as f:
        ids = json.load(f)
    return text, visual, ids


def listing_index() -> dict[str, int]:
    _, _, ids = load_embeddings()
    return {lid: i for i, lid in enumerate(ids)}


def get_listing(listing_id: str) -> dict | None:
    for item in load_listings():
        if item["id"] == listing_id:
            return item
    return None


def image_path(filename: str) -> Path:
    return settings.images_dir / filename
