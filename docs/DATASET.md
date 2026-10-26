# Dataset documentation

## Source

**ListingGenie — Synthetic Multimodal Real-Estate Listings**

- Hugging Face: https://huggingface.co/datasets/omersh234/listinggenie-listings
- License: MIT
- Size: 1,674 synthetic listings with AI-generated interior photos (SDXL-Turbo) and structured attributes

## Adaptation for SwipeNest AI

Script: `scripts/prepare_dataset.py`

Transformations applied:

1. Sample ~400 listings (configurable via `--count`).
2. Map source cities to **Paris arrondissements** (1–20) with realistic coordinates.
3. Convert synthetic USD sale prices into plausible **Paris monthly rents** using arrondissement €/m² references.
4. Normalize amenities, property types, and interior styles.
5. Persist images locally as JPEG (`data/images/`) so the demo never depends on hotlinked URLs.
6. Compute **text embeddings** with `sentence-transformers/all-MiniLM-L6-v2`.
7. Compute lightweight **visual features** (brightness, warmth, contrast, edge energy, palette).
8. Inject **5 synthetic scam test listings** with known warning signals.

## Important notice

All listings are **synthetic demonstration data**. They are not real currently available apartments.

## Rent references

`data/processed/rent_references.json` stores approximate €/m² references by arrondissement for scam risk scoring. These are demo-oriented approximations informed by publicly discussed Paris rental bands, not an official statistical extract.

## Regeneration

```bash
backend/.venv/bin/python scripts/prepare_dataset.py --count 400 --seed 42
```
